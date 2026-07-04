import { Money } from "@mainspring/schema";

/**
 * Display formatting only. The engine stays exact; here we render for the eye.
 * Number() is fine at the display boundary (DESIGN_SYSTEM: numbers are instrument readings).
 */
export function formatMoney(m: Money, opts?: { cents?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(Number(m.toString()));
}

export function formatPct(pct: string | number): string {
  return `${Math.round(Number(pct) * 100)}%`;
}

/** Format a plain number as USD (for market values, which are float estimates). */
export function formatUsd(n: number, opts?: { cents?: boolean }): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(n);
}

/** Short suffix for a recurring cadence, e.g. "wk", "mo", "yr". */
export function cadenceAbbrev(cadence: string): string {
  return { weekly: "wk", biweekly: "2wk", monthly: "mo", quarterly: "qtr", annual: "yr" }[cadence] ?? cadence;
}
