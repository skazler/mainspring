import Decimal from "decimal.js";

/**
 * Money — the exact-decimal value object for MAINSPRING.
 *
 * Non-negotiable (see docs/DOMAIN_MODEL.md §2):
 *  - Money is NEVER a JS float. The only public constructor is `Money.of(string)`.
 *    A `number` cannot be passed in — enforced by types, a runtime guard, and the
 *    `no-float-money` lint rule.
 *  - Full precision is kept internally; HALF_UP rounding is applied only at the
 *    display / persist boundary (`toString`, `toMinorUnits`, `toJSON`), never mid-calc.
 *  - DB storage is Postgres NUMERIC(18,4); SCALE here matches that.
 */

// MAINSPRING money math always rounds HALF_UP at boundaries.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 40 });

/** Decimal places stored at the persist boundary — matches NUMERIC(18,4). */
export const MONEY_SCALE = 4 as const;

const TEN_POW_SCALE = new Decimal(10).pow(MONEY_SCALE);

/** A dimensionless factor for multiply/allocate — a rate, share, or count. Never money. */
export type Factor = Decimal | string;

export class Money {
  /** Branded so structurally-similar objects can't masquerade as Money. */
  private readonly __brand = "Money" as const;
  private readonly d: Decimal;

  private constructor(d: Decimal) {
    this.d = d;
  }

  /**
   * The one public constructor. Accepts a decimal STRING only (e.g. "12345.6789").
   * Passing a number is a type error; passing a non-finite/garbage string throws.
   */
  static of(value: string): Money {
    if (typeof (value as unknown) !== "string") {
      throw new TypeError("Money.of expects a decimal string, never a float. Got a non-string.");
    }
    const d = new Decimal(value);
    if (!d.isFinite()) {
      throw new RangeError(`Money.of received a non-finite value: ${value}`);
    }
    return new Money(d);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  /** Reconstruct from integer minor units (1/10^SCALE). Used at the TS↔Rust/DB boundary. */
  static fromMinorUnits(units: bigint): Money {
    return new Money(new Decimal(units.toString()).div(TEN_POW_SCALE));
  }

  add(other: Money): Money {
    return new Money(this.d.plus(other.d));
  }

  subtract(other: Money): Money {
    return new Money(this.d.minus(other.d));
  }

  /** Multiply by a dimensionless factor (a rate/share), e.g. tax of gross. */
  multiply(factor: Factor): Money {
    return new Money(this.d.times(new Decimal(factor)));
  }

  /**
   * Penny-safe split into parts proportional to `weights` (dinero-style allocate).
   * Operates on integer minor units so `Σ parts === this` exactly; the largest
   * remainders absorb the leftover units. Weights need not sum to 1.
   */
  allocate(weights: ReadonlyArray<Factor>): Money[] {
    if (weights.length === 0) {
      throw new RangeError("allocate requires at least one weight");
    }
    const w = weights.map((x) => new Decimal(x));
    if (w.some((x) => x.isNegative())) {
      throw new RangeError("allocate weights must be non-negative");
    }
    const total = w.reduce((a, b) => a.plus(b), new Decimal(0));
    if (total.isZero()) {
      throw new RangeError("allocate weights must not sum to zero");
    }

    const totalUnits = this.toMinorUnitsDecimal();
    // Floor each share, track remainders, then distribute the leftover units.
    const shares = w.map((weight) => totalUnits.times(weight).div(total));
    const floored = shares.map((s) => s.floor());
    let distributed = floored.reduce((a, b) => a.plus(b), new Decimal(0));
    let leftover = totalUnits.minus(distributed);

    const order = shares
      .map((s, i) => ({ i, rem: s.minus(floored[i]!) }))
      .sort((a, b) => b.rem.comparedTo(a.rem));

    const result = floored.slice();
    for (const { i } of order) {
      if (leftover.lte(0)) break;
      result[i] = result[i]!.plus(1);
      leftover = leftover.minus(1);
    }
    return result.map((units) => new Money(units.div(TEN_POW_SCALE)));
  }

  // ── comparisons ────────────────────────────────────────────────
  equals(other: Money): boolean {
    return this.d.eq(other.d);
  }
  compare(other: Money): -1 | 0 | 1 {
    return this.d.comparedTo(other.d) as -1 | 0 | 1;
  }
  isZero(): boolean {
    return this.d.isZero();
  }
  isNegative(): boolean {
    return this.d.isNegative();
  }

  // ── boundary outputs (rounding happens HERE only) ──────────────
  private toMinorUnitsDecimal(): Decimal {
    return this.d.times(TEN_POW_SCALE).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }
  /** Integer minor units, rounded HALF_UP. For the DB/Rust boundary. */
  toMinorUnits(): bigint {
    return BigInt(this.toMinorUnitsDecimal().toFixed(0));
  }
  /** Fixed-scale decimal string, e.g. "12345.6789". The persisted form. */
  toString(): string {
    return this.d.toFixed(MONEY_SCALE, Decimal.ROUND_HALF_UP);
  }
  toJSON(): string {
    return this.toString();
  }
}
