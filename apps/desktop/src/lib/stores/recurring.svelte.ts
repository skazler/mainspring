import { annualizeItem, annualizeRecurring, recurringByCategory, type RecurringItem } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteRecurring, loadRecurring, saveRecurring, type RecurringRow } from "$lib/db";
import { endOfThisMonth, localToday } from "$lib/date";
import { profile } from "./profile.svelte";

/** A row still counts if it's active and today is on/before its end date. */
function isLive(r: RecurringRow): boolean {
  return r.active && (!r.endsOn || r.endsOn >= localToday());
}

function toItem(r: RecurringRow): RecurringItem {
  // The engine is date-free; fold the end-date gate into `active` here so an
  // ended item drops out of the rate automatically once the month rolls over.
  return { amount: Money.of(r.amount), cadence: r.cadence, category: r.category, kind: r.kind, active: isLive(r) };
}

/**
 * Recurring items on a cadence, split by kind:
 *  - "bill" (insurance, car, API costs) → total expenses (annualCommitments)
 *  - "investment" (e.g. $50/wk into Acorns) → total contributions (annualInvestments)
 * Both are pushed onto the profile so they flow through recompute.
 */
class RecurringStore {
  rows = $state<RecurringRow[]>([]);
  error = $state<string | null>(null);

  get bills(): RecurringRow[] {
    return this.rows.filter((r) => r.kind === "bill");
  }
  get investments(): RecurringRow[] {
    return this.rows.filter((r) => r.kind === "investment");
  }

  /** Annual cost of active bills. */
  get billsAnnual(): Money {
    return annualizeRecurring(this.bills.map(toItem));
  }
  /** Annual amount of active auto-invest contributions. */
  get investmentsAnnual(): Money {
    return annualizeRecurring(this.investments.map(toItem));
  }
  /** Active bills grouped by category (annualized), largest first. */
  get billsByCategory(): { category: string; annual: Money }[] {
    return recurringByCategory(this.bills.map(toItem));
  }

  /** Annualized cost of a single row (for the per-row "…/yr" readout). */
  annual(r: RecurringRow): Money {
    return annualizeItem({ amount: Money.of(r.amount), cadence: r.cadence });
  }

  private sync(): void {
    profile.annualCommitments = this.billsAnnual;
    profile.annualInvestments = this.investmentsAnnual;
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

  /** True while a row still counts toward the plan (active and not past its end). */
  live(r: RecurringRow): boolean {
    return isLive(r);
  }

  /**
   * Stop a recurring item at the end of the current month: it still counts this
   * month (its charge already landed), then drops out of the plan next month.
   */
  endAfterThisMonth(id: string): void {
    const r = this.rows.find((x) => x.id === id);
    if (r) this.save({ ...r, active: true, endsOn: endOfThisMonth() });
  }

  /** Remove a recurring item outright, effective now (drops from this month too). */
  remove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.sync();
    deleteRecurring(id).catch((e) => this.fail(e));
  }
}

export const recurring = new RecurringStore();
