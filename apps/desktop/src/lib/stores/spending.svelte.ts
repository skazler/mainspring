import {
  annualizeTrailing,
  monthTotal,
  spendingByCategory,
  trailingTotal,
  TRAILING_WINDOW_DAYS,
  type SpendingEntry,
} from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteSpending, loadSpending, saveSpending, type SpendingRow } from "$lib/db";
import { profile } from "./profile.svelte";

function toEntry(r: SpendingRow): SpendingEntry {
  return { category: r.category, amount: Money.of(r.amount), spentAt: r.spentAt };
}

const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Variable/discretionary spending. The plan uses a TRAILING 30-DAY run-rate
 * scaled to a year. A calendar month was the obvious choice but reset to ~0 on
 * the 1st, which cut the FI number (expenses ÷ SWR magnifies any change 25×)
 * and inflated savings for the first days of every month — the projection
 * sawtoothed. A sliding window has no boundary to fall off. History is kept in
 * full for the lists and the category breakdown.
 */
class SpendingStore {
  readonly windowDays = TRAILING_WINDOW_DAYS;

  rows = $state<SpendingRow[]>([]);
  error = $state<string | null>(null);

  /** Trailing-30-day spending scaled to a year — the figure that feeds the plan. */
  get annualized(): Money {
    return annualizeTrailing(this.rows.map(toEntry), today());
  }
  /** Trailing-30-day spending (not annualized) — matches what the plan uses. */
  get windowTotal(): Money {
    return trailingTotal(this.rows.map(toEntry), today());
  }
  /** This month's spending so far (not annualized). Calendar-month readout only. */
  get thisMonthTotal(): Money {
    return monthTotal(this.rows.map(toEntry), thisMonth());
  }
  get byCategory(): { category: string; total: Money }[] {
    return spendingByCategory(this.rows.map(toEntry));
  }

  private sync(): void {
    profile.variableAnnualSpending = this.annualized;
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  async load(): Promise<void> {
    try {
      this.rows = await loadSpending();
    } catch (e) {
      this.fail(e);
    }
    this.sync();
  }

  // Update the UI immediately, then persist in the background — so logging works
  // even if the local DB is slow/unavailable (the error surfaces, nothing hangs).
  async add(row: SpendingRow): Promise<void> {
    this.rows = [row, ...this.rows];
    this.sync();
    saveSpending(row).catch((e) => this.fail(e));
  }

  async remove(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.sync();
    deleteSpending(id).catch((e) => this.fail(e));
  }

  /** Edit an existing entry in place (e.g. re-categorize). Persists by id upsert. */
  update(row: SpendingRow): void {
    const i = this.rows.findIndex((r) => r.id === row.id);
    if (i < 0) return;
    this.rows[i] = row;
    this.sync();
    saveSpending(row).catch((e) => this.fail(e));
  }
}

export const spending = new SpendingStore();
