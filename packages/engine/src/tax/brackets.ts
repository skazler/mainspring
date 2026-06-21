import { Money } from "@mainspring/schema";
import { minMoney } from "../money-util";

export interface Bracket {
  /** Upper bound of this bracket; `null` = top bracket (no ceiling). */
  upTo: Money | null;
  /** Marginal rate within this bracket, as a decimal string e.g. "0.22". */
  rate: string;
}

/**
 * Progressive bracket application. Each bracket taxes only the portion of
 * `taxable` that falls within it. Pure; exact to the cent via {@link Money}.
 */
export function applyBrackets(taxable: Money, brackets: readonly Bracket[]): Money {
  if (taxable.compare(Money.zero()) <= 0) return Money.zero();
  let tax = Money.zero();
  let floor = Money.zero();
  for (const b of brackets) {
    const ceiling = b.upTo ?? taxable;
    const top = minMoney(taxable, ceiling);
    if (top.compare(floor) > 0) {
      tax = tax.add(top.subtract(floor).multiply(b.rate));
    }
    floor = ceiling;
    if (taxable.compare(ceiling) <= 0) break;
  }
  return tax;
}

/** Marginal rate at `taxable` — the rate the next dollar of taxable income hits. */
export function marginalBracketRate(taxable: Money, brackets: readonly Bracket[]): string {
  if (taxable.compare(Money.zero()) <= 0) return "0";
  for (const b of brackets) {
    if (b.upTo === null || taxable.compare(b.upTo) <= 0) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? "0";
}
