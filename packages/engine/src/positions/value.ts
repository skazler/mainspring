import Decimal from "decimal.js";
import { Money } from "@mainspring/schema";
import type { OpenLot } from "./lots";

/** Market value of a position: shares × price-per-share. */
export function positionValue(shares: Decimal | string, pricePerShare: Money): Money {
  return pricePerShare.multiply(new Decimal(shares));
}

/** Unrealized (on-paper) gain: market value − cost basis. */
export function unrealizedGain(value: Money, costBasis: Money): Money {
  return value.subtract(costBasis);
}

/** Total cost basis of a set of open lots. */
export function costBasis(openLots: readonly OpenLot[]): Money {
  return openLots.reduce((sum, lot) => sum.add(lot.costBasis), Money.zero());
}

/** Total open shares across lots. */
export function openShares(openLots: readonly OpenLot[]): Decimal {
  return openLots.reduce((sum, lot) => sum.plus(lot.shares), new Decimal(0));
}
