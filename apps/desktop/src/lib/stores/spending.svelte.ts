import {
  annualizeMonth,
  annualizeTrailing,
  monthTotal,
  spendingByCategory,
  trailingTotal,
  TRAILING_WINDOW_DAYS,
  type SpendingEntry,
} from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteSpending, loadSpending, saveSpending, type SpendingRow } from "$lib/db";
import { localToday } from "$lib/date";
import { clock } from "./clock.svelte";
import { profile } from "./profile.svelte";

function toEntry(r: SpendingRow): SpendingEntry {
  return { category: r.category, amount: Money.of(r.amount), spentAt: r.spentAt };
}

const today = localToday;

/**
 * Variable/discretionary spending, read two ways on purpose.
 *
 * The PROJECTION (FI number, net worth) uses a TRAILING 30-DAY run-rate scaled
 * to a year. A calendar month was the obvious choice but reset to ~0 on the 1st,
 * which cut the FI number (expenses ÷ SWR magnifies any change 25×) and inflated
 * savings for the first days of every month — the projection sawtoothed. A
 * sliding window has no boundary to fall off.
 *
 * The BUDGET uses the calendar month (`thisMonthTotal`). The same sliding window
 * that smooths the projection is wrong here: purchases age out of it mid-month,
 * so "remaining" would climb back up on days you spent nothing, and logging a
 * coffee could raise your budget if something large aged out the same day. A
 * budget has to reset on the 1st and only fall. See `monthlyBudget` in the
 * engine.
 *
 * History is kept in full for the lists and the category breakdown.
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
  /**
   * Spending logged since the 1st — the figure the monthly budget draws down.
   * Keyed off the reactive clock so it drops to zero the moment the month turns,
   * app open or not.
   */
  get thisMonthTotal(): Money {
    return monthTotal(this.rows.map(toEntry), clock.month);
  }
  /**
   * This month's spending scaled to a year — what the BREAKDOWN reads.
   * Resets to zero on the 1st and fills in as the month runs, so "where every
   * dollar goes" answers for the month you're actually in. Deliberately not
   * `annualized`: that one has to slide, this one has to reset.
   */
  get thisMonthAnnualized(): Money {
    return annualizeMonth(this.rows.map(toEntry), clock.month);
  }
  /** All-time totals per category. */
  get byCategory(): { category: string; total: Money }[] {
    return spendingByCategory(this.rows.map(toEntry));
  }
  /**
   * Category totals for this calendar month — the mix the breakdown drill-down
   * splits by, matching the month-scale figure the Spending slice now shows.
   */
  get monthByCategory(): { category: string; total: Money }[] {
    return spendingByCategory(this.rowsIn(clock.month).map(toEntry));
  }

  /** Rows for one calendar month (YYYY-MM), or all rows when month is null. */
  rowsIn(month: string | null): SpendingRow[] {
    return month ? this.rows.filter((r) => String(r.spentAt).slice(0, 7) === month) : this.rows;
  }

  /**
   * Category totals for one calendar month (null = all time). The breakdown sits
   * beside a month-grouped history, so it takes the same period rather than
   * silently showing lifetime totals next to a single month's entries.
   */
  byCategoryIn(month: string | null): { category: string; total: Money }[] {
    return spendingByCategory(this.rowsIn(month).map(toEntry));
  }

  /** The months present in the log, newest first (YYYY-MM). */
  get loggedMonths(): string[] {
    return [...new Set(this.rows.map((r) => String(r.spentAt).slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  }

  /** Push both spending figures into the profile the engine reads. */
  sync(): void {
    profile.variableAnnualSpending = this.annualized;
    profile.breakdownAnnualSpending = this.thisMonthAnnualized;
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

// The date is an input, not a snapshot. `sync()` only runs when a row changes,
// so on a machine left open past midnight on the 1st the breakdown would keep
// showing last month's spending until the user happened to log something. The
// month-to-date figure reads `clock.month`, so tracking it here re-syncs the
// profile the moment the month turns. (Same reasoning as clock.svelte.ts.)
$effect.root(() => {
  $effect(() => {
    void clock.month;
    spending.sync();
  });
});
