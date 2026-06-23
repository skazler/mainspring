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

/** A daily close bar, as returned by the native market fetch. */
export interface Bar {
  date: string;
  close: number;
}

/** Fetch daily history via the Rust core (native HTTP, no CORS). */
export const fetchMarket = (ticker: string, range = "5y", interval = "1d") =>
  invoke<Bar[]>("fetch_market", { ticker, range, interval });

/**
 * POST a pre-built Anthropic Messages API body through the Rust core (key stays
 * native, no CORS). Returns the raw response JSON text. (FRONTEND §4 / AI_WORKFLOWS.)
 */
export const anthropicMessage = (apiKey: string, body: string) =>
  invoke<string>("anthropic_message", { apiKey, body });
