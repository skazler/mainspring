import { Money } from "@mainspring/schema";

/**
 * States with no tax on wage income. TX is the baked-in default for MAINSPRING
 * (see docs/MONEY_ENGINE.md §3) — zero state income tax materially raises
 * take-home versus a CA/NY plan.
 *
 * (NH/WA tax some investment income but not wages; treated as 0 for wage income.)
 */
const NO_WAGE_INCOME_TAX_STATES = new Set([
  "AK",
  "FL",
  "NH",
  "NV",
  "SD",
  "TN",
  "TX",
  "WA",
  "WY",
]);

function unsupported(state: string): never {
  throw new Error(
    `State income tax for "${state}" is not modeled yet. Phase 2 supports no-income-tax states (incl. TX). ` +
      `Add a bracket table for "${state}" to extend coverage.`,
  );
}

export function computeStateTax(_taxableIncome: Money, state: string): Money {
  const s = state.toUpperCase();
  if (NO_WAGE_INCOME_TAX_STATES.has(s)) return Money.zero();
  return unsupported(s);
}

export function stateMarginalRate(state: string): string {
  const s = state.toUpperCase();
  if (NO_WAGE_INCOME_TAX_STATES.has(s)) return "0";
  return unsupported(s);
}
