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
