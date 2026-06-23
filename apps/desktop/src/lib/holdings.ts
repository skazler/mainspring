/** A simple current position. (The full buy/sell lot ledger is engine-side; this
 *  view enters a position directly.) Values here are display-oriented numbers. */
export interface Holding {
  ticker: string;
  shares: number;
  /** Total dollars paid (cost basis). */
  costBasis: number;
  /** ISO acquisition date. */
  acquiredOn: string;
}

export function holdingValue(h: Holding, price: number): number {
  return h.shares * price;
}

export function holdingGain(h: Holding, price: number): number {
  return holdingValue(h, price) - h.costBasis;
}

/** Portfolio market value, summing only holdings we have a price for. */
export function portfolioValue(holdings: readonly Holding[], prices: Record<string, number>): number {
  return holdings.reduce((sum, h) => {
    const p = prices[h.ticker];
    return p == null ? sum : sum + holdingValue(h, p);
  }, 0);
}

export function portfolioCostBasis(holdings: readonly Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.costBasis, 0);
}
