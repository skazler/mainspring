import { invoke } from "@tauri-apps/api/core";

/** Mirrors crates/sim SimParams (camelCase via serde). */
export interface SimParams {
  startBalance: number;
  annualContribution: number;
  annualExpenses: number;
  yearsAccumulation: number;
  yearsTotal: number;
  mu: number;
  sigma: number;
  nPaths: number;
  seed: number;
  model: "gbm" | "bootstrap";
  historicalReturns?: number[];
}

/** Mirrors crates/sim Forecast. */
export interface Forecast {
  years: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  successProbability: number;
}

/** Heavy work crosses to the native Rust kernel via Tauri invoke (FRONTEND §4). */
export const runForecast = (params: SimParams) => invoke<Forecast>("run_forecast", { params });
