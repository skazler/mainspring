import { budgetIncomeIn, INCOME_WINDOW_DAYS, trailingIncome, type IncomeEntry } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteIncome, loadIncome, saveIncome, type IncomeRow } from "$lib/db";
import { clock } from "./clock.svelte";
import { profile } from "./profile.svelte";

function toEntry(r: IncomeRow): IncomeEntry {
  return { amount: Money.of(r.amount), receivedAt: r.receivedAt, selfEmployed: r.selfEmployed, toBudget: r.toBudget };
}

/**
 * Irregular income — gig payouts, gifts, windfalls — logged as it arrives.
 *
 * Each entry goes one of two ways, never both:
 *  - into the PLAN, as the trailing year's total (not scaled up). Lumpy income
 *    only averages out over a year; a 30-day window like spending's would turn
 *    one payout into a phantom salary and then drop it a month later.
 *  - into THIS MONTH'S BUDGET (`toBudget`), after tax, in the month it arrived.
 *    That money is spent, so it stays out of gross and the freedom projection.
 */
class IncomeStore {
  readonly windowDays = INCOME_WINDOW_DAYS;

  rows = $state<IncomeRow[]>([]);
  error = $state<string | null>(null);

  private get entries(): IncomeEntry[] {
    return this.rows.map(toEntry);
  }

  /** Trailing-year income that feeds the plan, pre-tax. */
  get planTotal(): Money {
    const t = trailingIncome(this.entries, clock.today);
    return t.selfEmployed.add(t.untaxed);
  }

  /** Budget-bound income received this calendar month, pre-tax. */
  get budgetTotal(): Money {
    const b = budgetIncomeIn(this.entries, clock.month);
    return b.selfEmployed.add(b.untaxed);
  }

  /** Push both figures into the profile the engine reads. */
  sync(): void {
    profile.irregularIncome = trailingIncome(this.entries, clock.today);
    profile.budgetIncome = budgetIncomeIn(this.entries, clock.month);
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  async load(): Promise<void> {
    try {
      this.rows = await loadIncome();
    } catch (e) {
      this.fail(e);
    }
    this.sync();
  }

  // Same optimistic pattern as spending: update the UI, persist in the background.
  add(row: IncomeRow): void {
    this.rows = [row, ...this.rows].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    this.sync();
    saveIncome(row).catch((e) => this.fail(e));
  }

  update(row: IncomeRow): void {
    const i = this.rows.findIndex((r) => r.id === row.id);
    if (i < 0) return;
    this.rows[i] = row;
    this.sync();
    saveIncome(row).catch((e) => this.fail(e));
  }

  remove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.sync();
    deleteIncome(id).catch((e) => this.fail(e));
  }
}

export const income = new IncomeStore();

// The trailing year slides a day at a time and the budget month turns on the
// 1st, so the date is an input: re-sync when it changes, app open or not.
$effect.root(() => {
  $effect(() => {
    void clock.today;
    income.sync();
  });
});
