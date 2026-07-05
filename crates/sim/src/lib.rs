//! MAINSPRING Monte Carlo kernel (PREDICTION_ENGINE §2).
//!
//! One source, two targets: native (Tauri `invoke`) and — later — WASM. The
//! TS side sees `simulate(params) -> { bands, successProbability }`. Paths run
//! *through* the withdrawal phase so sequence-of-returns risk is captured.
//!
//! Dependency-light by design (only serde for the boundary): the RNG is a small
//! seeded SplitMix64 + Box–Muller, so runs are reproducible and WASM-friendly.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Model {
    Gbm,
    Bootstrap,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimParams {
    pub start_balance: f64,
    /// Saved per year during accumulation.
    pub annual_contribution: f64,
    /// Withdrawn per year during decumulation (real dollars).
    pub annual_expenses: f64,
    /// Years of contributions before retirement.
    pub years_accumulation: usize,
    /// Planning horizon in years.
    pub years_total: usize,
    /// Mean real return (GBM drift, or the constant fallback for bootstrap).
    pub mu: f64,
    /// Volatility (GBM).
    pub sigma: f64,
    pub n_paths: usize,
    pub seed: u64,
    pub model: Model,
    /// Annual real returns to resample (bootstrap model).
    #[serde(default)]
    pub historical_returns: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Forecast {
    /// 1..=years_total.
    pub years: Vec<usize>,
    pub p10: Vec<f64>,
    pub p25: Vec<f64>,
    pub p50: Vec<f64>,
    pub p75: Vec<f64>,
    pub p90: Vec<f64>,
    /// Share of paths that never deplete through the horizon.
    pub success_probability: f64,
}

/// Seeded SplitMix64 + Box–Muller. Deterministic per (seed, path).
struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Rng { state: seed }
    }
    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn next_f64(&mut self) -> f64 {
        // 53-bit mantissa in [0, 1)
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
    fn next_normal(&mut self) -> f64 {
        let u1 = self.next_f64().max(1e-12);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

fn percentile(sorted: &[f64], q: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    if sorted.len() == 1 {
        return sorted[0];
    }
    let rank = q * (sorted.len() - 1) as f64;
    let lo = rank.floor() as usize;
    let hi = rank.ceil() as usize;
    let frac = rank - lo as f64;
    sorted[lo] + (sorted[hi] - sorted[lo]) * frac
}

/// Run the simulation: per path, grow + contribute (accumulation) then
/// grow − withdraw (decumulation), then take percentiles per year.
pub fn simulate(p: &SimParams) -> Forecast {
    let n_years = p.years_total;
    let mut year_balances: Vec<Vec<f64>> = vec![Vec::with_capacity(p.n_paths); n_years];
    let mut survived = 0usize;

    // Sanitize: mu is an *arithmetic* annual return, so mu <= -1 would make the
    // GBM log-drift undefined; non-finite mu/sigma would poison the percentile
    // sort with NaN. Clamp both to a safe finite range.
    let mu = if p.mu.is_finite() {
        p.mu.max(-0.999)
    } else {
        0.0
    };
    let sigma = if p.sigma.is_finite() {
        p.sigma.max(0.0)
    } else {
        0.0
    };
    // GBM log-drift m so that E[growth] = 1 + mu and sigma = 0 reduces *exactly*
    // to (1 + mu) compounding — matching projectBalances (D3). mu arrives as an
    // arithmetic annual return (annualizedStats), never as a log-drift.
    let m = (1.0 + mu).ln() - 0.5 * sigma * sigma;

    for path in 0..p.n_paths {
        let mut rng = Rng::new(p.seed ^ (path as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15));
        let mut bal = p.start_balance;
        let mut depleted = false;

        for y in 0..n_years {
            let growth = match p.model {
                Model::Gbm => {
                    let z = rng.next_normal();
                    (m + sigma * z).exp()
                }
                Model::Bootstrap => {
                    if p.historical_returns.is_empty() {
                        1.0 + mu
                    } else {
                        // Modulo bias is negligible at these array lengths; do not
                        // "fix" it into a rejection loop and break reproducibility.
                        let idx = (rng.next_u64() as usize) % p.historical_returns.len();
                        1.0 + p.historical_returns[idx]
                    }
                }
            };
            bal *= growth;
            if y < p.years_accumulation {
                bal += p.annual_contribution;
            } else {
                bal -= p.annual_expenses;
            }
            if bal <= 0.0 {
                bal = 0.0;
                depleted = true;
            }
            year_balances[y].push(bal);
        }
        if !depleted {
            survived += 1;
        }
    }

    let mut p10 = Vec::with_capacity(n_years);
    let mut p25 = Vec::with_capacity(n_years);
    let mut p50 = Vec::with_capacity(n_years);
    let mut p75 = Vec::with_capacity(n_years);
    let mut p90 = Vec::with_capacity(n_years);
    for y in 0..n_years {
        let mut v = std::mem::take(&mut year_balances[y]);
        // NaN-safe (inputs are sanitized above, but never unwrap a partial_cmp).
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        p10.push(percentile(&v, 0.10));
        p25.push(percentile(&v, 0.25));
        p50.push(percentile(&v, 0.50));
        p75.push(percentile(&v, 0.75));
        p90.push(percentile(&v, 0.90));
    }

    Forecast {
        years: (1..=n_years).collect(),
        p10,
        p25,
        p50,
        p75,
        p90,
        success_probability: if p.n_paths == 0 {
            0.0
        } else {
            survived as f64 / p.n_paths as f64
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> SimParams {
        SimParams {
            start_balance: 100_000.0,
            annual_contribution: 30_000.0,
            annual_expenses: 40_000.0,
            years_accumulation: 20,
            years_total: 40,
            mu: 0.05,
            sigma: 0.15,
            n_paths: 2000,
            seed: 42,
            model: Model::Gbm,
            historical_returns: vec![],
        }
    }

    #[test]
    fn deterministic_for_a_fixed_seed() {
        let a = simulate(&base());
        let b = simulate(&base());
        assert_eq!(a.p50, b.p50);
        assert_eq!(a.success_probability, b.success_probability);
    }

    #[test]
    fn percentiles_are_ordered_each_year() {
        let f = simulate(&base());
        for y in 0..f.years.len() {
            assert!(f.p10[y] <= f.p25[y]);
            assert!(f.p25[y] <= f.p50[y]);
            assert!(f.p50[y] <= f.p75[y]);
            assert!(f.p75[y] <= f.p90[y]);
        }
    }

    #[test]
    fn success_probability_is_a_fraction() {
        let p = simulate(&base()).success_probability;
        assert!((0.0..=1.0).contains(&p));
    }

    #[test]
    fn zero_vol_matches_closed_form_accumulation() {
        // sigma = 0 → deterministic compounding at exactly (1 + mu); the MC
        // median must equal projectBalances' (1 + mu) recurrence (D3/F3).
        let mut p = base();
        p.sigma = 0.0;
        p.years_accumulation = 10;
        p.years_total = 10;
        p.n_paths = 16;
        let f = simulate(&p);

        let mut bal = 100_000.0_f64;
        for _ in 0..10 {
            bal = bal * 1.05 + 30_000.0; // (1 + mu), mu = 0.05
        }
        let median = f.p50[9];
        assert!(
            (median - bal).abs() < 1e-6,
            "median {median} vs closed form {bal}"
        );
    }

    #[test]
    fn heavy_withdrawals_can_fail() {
        let mut p = base();
        p.start_balance = 50_000.0;
        p.annual_contribution = 0.0;
        p.annual_expenses = 60_000.0;
        p.years_accumulation = 0; // immediate decumulation
        let f = simulate(&p);
        assert!(f.success_probability < 1.0);
    }
}
