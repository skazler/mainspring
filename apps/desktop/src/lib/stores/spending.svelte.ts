import { annualizeSpending, spendingByCategory, type SpendingEntry } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteSpending, loadSpending, saveSpending, type SpendingRow } from "$lib/db";
import { profile } from "./profile.svelte";

function toEntry(r: SpendingRow): SpendingEntry {
  return { category: r.category, amount: Money.of(r.amount), spentAt: r.spentAt };
}

/**
 * Variable/discretionary spending. Annualized and pushed onto the profile so it
 * flows through recompute — raising total expenses (and the FI number) and
 * shrinking the savings pool.
 */
class SpendingStore {
  rows = $state<SpendingRow[]>([]);

  get annualized(): Money {
    return annualizeSpending(this.rows.map(toEntry));
  }
  get byCategory(): { category: string; total: Money }[] {
    return spendingByCategory(this.rows.map(toEntry));
  }

  private sync(): void {
    profile.variableAnnualSpending = this.annualized;
  }

  async load(): Promise<void> {
    this.rows = await loadSpending();
    this.sync();
  }

  async add(row: SpendingRow): Promise<void> {
    await saveSpending(row);
    this.rows = await loadSpending();
    this.sync();
  }

  async remove(id: string): Promise<void> {
    await deleteSpending(id);
    this.rows = await loadSpending();
    this.sync();
  }
}

export const spending = new SpendingStore();
