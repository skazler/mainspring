import { annualizeMonth, monthTotal, spendingByCategory, type SpendingEntry } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteSpending, loadSpending, saveSpending, type SpendingRow } from "$lib/db";
import { profile } from "./profile.svelte";

function toEntry(r: SpendingRow): SpendingEntry {
  return { category: r.category, amount: Money.of(r.amount), spentAt: r.spentAt };
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Variable/discretionary spending. The plan uses the CURRENT month's spending,
 * projected out (×12) and resetting each month — so a big month doesn't haunt
 * the budget forever, and each month starts fresh. History is kept for the lists.
 */
class SpendingStore {
  rows = $state<SpendingRow[]>([]);
  error = $state<string | null>(null);

  /** This month's spending × 12 — the figure that feeds the plan. */
  get annualized(): Money {
    return annualizeMonth(this.rows.map(toEntry), thisMonth());
  }
  /** This month's spending so far (not annualized). */
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
