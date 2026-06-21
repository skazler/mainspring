import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import type { LotMethod } from "@mainspring/schema";

/**
 * An open buy-lot in engine form: remaining shares + the cost basis for those
 * remaining shares (basis includes any allocated buy fee). Derived from the
 * `lots` ledger; see docs/STOCK_MANAGEMENT.md.
 */
export interface OpenLot {
  id: string;
  shares: Decimal;
  costBasis: Money;
  /** ISO acquisition date, e.g. "2024-01-15". */
  acquiredOn: string;
}

export interface SaleInput {
  shares: Decimal;
  pricePerShare: Money;
  fee?: Money;
  /** ISO disposal date. */
  soldOn: string;
  method: LotMethod;
  /** Required when method is "specific-id". */
  specificLotId?: string;
}

export interface RealizedGains {
  shortTerm: Money;
  longTerm: Money;
}

export interface SaleResult {
  realized: RealizedGains;
  proceeds: Money;
  /** Lots after the sale (consumed lots removed, partial lots reduced). */
  remainingLots: OpenLot[];
}

/**
 * Long-term if held *more than* one year (a year and a day) — the IRS rule.
 * Pure: compares two explicit dates, no clock.
 */
export function isLongTerm(acquiredOn: string, soldOn: string): boolean {
  const a = new Date(`${acquiredOn}T00:00:00Z`);
  const oneYearAndADayLater = new Date(
    Date.UTC(a.getUTCFullYear() + 1, a.getUTCMonth(), a.getUTCDate() + 1),
  );
  const sold = new Date(`${soldOn}T00:00:00Z`);
  return sold.getTime() >= oneYearAndADayLater.getTime();
}

/**
 * Dispose `sale.shares` against open lots using the chosen tax-lot method,
 * returning realized ST/LT gains, net proceeds, and the remaining lots.
 *
 * - FIFO: oldest lots first.
 * - specific-id: the named lot first (must cover the sale).
 * Basis and the sell fee are allocated pro-rata when a lot is partially sold.
 */
export function realizeSale(sale: SaleInput, openLots: readonly OpenLot[]): SaleResult {
  const fee = sale.fee ?? Money.zero();
  const ordered = orderLots(sale, openLots);
  // working copies so we don't mutate the input
  const working = ordered.map((l) => ({ ...l }));

  let remaining = sale.shares;
  const disposals: { shares: Decimal; basis: Money; longTerm: boolean }[] = [];

  for (const lot of working) {
    if (remaining.lte(0)) break;
    const take = Decimal.min(lot.shares, remaining);
    if (take.lte(0)) continue;
    const ratio = take.div(lot.shares);
    const basisPortion = lot.costBasis.multiply(ratio);
    disposals.push({ shares: take, basis: basisPortion, longTerm: isLongTerm(lot.acquiredOn, sale.soldOn) });
    lot.shares = lot.shares.minus(take);
    lot.costBasis = lot.costBasis.subtract(basisPortion);
    remaining = remaining.minus(take);
  }

  if (remaining.gt(0)) {
    throw new Error(
      `realizeSale: not enough open shares to dispose (${remaining.toString()} short)` +
        (sale.method === "specific-id" ? ` for specific lot ${sale.specificLotId}` : ""),
    );
  }

  let shortTerm = Money.zero();
  let longTerm = Money.zero();
  for (const d of disposals) {
    const chunkProceeds = sale.pricePerShare.multiply(d.shares);
    const feeShare = fee.multiply(d.shares.div(sale.shares));
    const gain = chunkProceeds.subtract(d.basis).subtract(feeShare);
    if (d.longTerm) longTerm = longTerm.add(gain);
    else shortTerm = shortTerm.add(gain);
  }

  const proceeds = sale.pricePerShare.multiply(sale.shares).subtract(fee);
  const remainingLots = working.filter((l) => l.shares.gt(0));

  return { realized: { shortTerm, longTerm }, proceeds, remainingLots };
}

function orderLots(sale: SaleInput, openLots: readonly OpenLot[]): OpenLot[] {
  if (sale.method === "specific-id") {
    if (!sale.specificLotId) {
      throw new Error("realizeSale: specific-id method requires specificLotId");
    }
    const named = openLots.find((l) => l.id === sale.specificLotId);
    if (!named) throw new Error(`realizeSale: lot ${sale.specificLotId} not found`);
    return [named, ...openLots.filter((l) => l.id !== sale.specificLotId)];
  }
  // FIFO — oldest first
  return [...openLots].sort((a, b) => a.acquiredOn.localeCompare(b.acquiredOn));
}
