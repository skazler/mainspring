import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import type { LotMethod } from "@mainspring/schema";
import { realizeSale, type OpenLot, type RealizedGains } from "./lots";

/** A buy/sell event from the ledger (the normalized `lots` rows). */
export interface LedgerLot {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  shares: string;
  pricePerShare: Money;
  fee?: Money;
  /** ISO trade date. */
  date: string;
  /** Disposal method for sells (default FIFO). */
  method?: LotMethod;
}

export interface TickerPosition {
  ticker: string;
  openLots: OpenLot[];
  openShares: Decimal;
  costBasis: Money;
  realized: RealizedGains;
}

/**
 * Fold a ledger of buy/sell lots into per-ticker positions: open lots + cost
 * basis (what you still hold) and realized ST/LT gains (what you've sold). Pure;
 * sells dispose against open lots via the engine's tax-lot logic.
 */
export function rollUpLots(lots: readonly LedgerLot[]): TickerPosition[] {
  const byTicker = new Map<string, LedgerLot[]>();
  for (const lot of lots) {
    const arr = byTicker.get(lot.ticker) ?? [];
    arr.push(lot);
    byTicker.set(lot.ticker, arr);
  }

  const positions: TickerPosition[] = [];
  for (const [ticker, group] of byTicker) {
    const chronological = [...group].sort((a, b) => a.date.localeCompare(b.date));
    let open: OpenLot[] = [];
    let shortTerm = Money.zero();
    let longTerm = Money.zero();

    for (const lot of chronological) {
      if (lot.side === "buy") {
        const fee = lot.fee ?? Money.zero();
        open.push({
          id: lot.id,
          shares: new Decimal(lot.shares),
          costBasis: lot.pricePerShare.multiply(lot.shares).add(fee),
          acquiredOn: lot.date,
        });
      } else {
        const sale = realizeSale(
          {
            shares: new Decimal(lot.shares),
            pricePerShare: lot.pricePerShare,
            ...(lot.fee ? { fee: lot.fee } : {}),
            soldOn: lot.date,
            method: lot.method ?? "fifo",
          },
          open,
        );
        shortTerm = shortTerm.add(sale.realized.shortTerm);
        longTerm = longTerm.add(sale.realized.longTerm);
        open = sale.remainingLots;
      }
    }

    positions.push({
      ticker,
      openLots: open,
      openShares: open.reduce((s, l) => s.plus(l.shares), new Decimal(0)),
      costBasis: open.reduce((s, l) => s.add(l.costBasis), Money.zero()),
      realized: { shortTerm, longTerm },
    });
  }

  return positions;
}
