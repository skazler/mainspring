import { annualizeItem, annualizeRecurring, type RecurringItem } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteRecurring, loadRecurring, saveRecurring, type RecurringRow } from "$lib/db";
import { profile } from "./profile.svelte";

function toItem(r: RecurringRow): RecurringItem {
  return { amount: Money.of(r.amount), cadence: r.cadence, active: r.active };
}

/**
 * Recurring commitments — insurance, car payment, subscriptions, API costs.
 * Annualized and pushed onto the profile so they flow through recompute: raising
 * total expenses (and the FI number) and claiming the savings pool.
 */
class RecurringStore {
  rows = $state<RecurringRow[]>([]);
  error = $state<string | null>(null);

  /** Annual cost of all active commitments. */
  get annualized(): Money {
    return annualizeRecurring(this.rows.map(toItem));
  }
  /** Annualized cost of a single row (for the per-row "…/yr" readout). */
  annual(r: RecurringRow): Money {
    return annualizeItem(toItem({ ...r, active: true }));
  }

  private sync(): void {
    profile.annualCommitments = this.annualized;
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  async load(): Promise<void> {
    try {
      this.rows = await loadRecurring();
    } catch (e) {
      this.fail(e);
    }
    this.sync();
  }

  // Optimistic: update the UI now, persist in the background.
  save(row: RecurringRow): void {
    const i = this.rows.findIndex((r) => r.id === row.id);
    if (i >= 0) this.rows[i] = row;
    else this.rows = [...this.rows, row];
    this.sync();
    saveRecurring(row).catch((e) => this.fail(e));
  }

  toggle(id: string): void {
    const r = this.rows.find((x) => x.id === id);
    if (r) this.save({ ...r, active: !r.active });
  }

  remove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.sync();
    deleteRecurring(id).catch((e) => this.fail(e));
  }
}

export const recurring = new RecurringStore();
