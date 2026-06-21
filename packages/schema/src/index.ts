import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as t from "./tables";

export * from "./money";
export * from "./tables";
export * from "./zod";

// Inferred row types — the single source of truth consumed by engine + UI.
export type Profile = InferSelectModel<typeof t.profiles>;
export type NewProfile = InferInsertModel<typeof t.profiles>;
export type IncomeSource = InferSelectModel<typeof t.incomeSources>;
export type NewIncomeSource = InferInsertModel<typeof t.incomeSources>;
export type TaxProfile = InferSelectModel<typeof t.taxProfiles>;
export type NewTaxProfile = InferInsertModel<typeof t.taxProfiles>;
export type Dial = InferSelectModel<typeof t.dials>;
export type NewDial = InferInsertModel<typeof t.dials>;
export type Account = InferSelectModel<typeof t.accounts>;
export type NewAccount = InferInsertModel<typeof t.accounts>;
export type Holding = InferSelectModel<typeof t.holdings>;
export type NewHolding = InferInsertModel<typeof t.holdings>;
export type Lot = InferSelectModel<typeof t.lots>;
export type NewLot = InferInsertModel<typeof t.lots>;
export type Contribution = InferSelectModel<typeof t.contributions>;
export type NewContribution = InferInsertModel<typeof t.contributions>;
export type Scenario = InferSelectModel<typeof t.scenarios>;
export type NewScenario = InferInsertModel<typeof t.scenarios>;
export type Forecast = InferSelectModel<typeof t.forecasts>;
export type NewForecast = InferInsertModel<typeof t.forecasts>;
export type MarketBar = InferSelectModel<typeof t.marketBars>;
export type NewMarketBar = InferInsertModel<typeof t.marketBars>;
