import { annualizeItem, goalStatus, type GoalStatus } from "@mainspring/engine";
import { Money, MoneyDecimal } from "@mainspring/schema";
import { deleteGoal, loadGoals, saveGoal, type GoalRow } from "$lib/db";
import { profile } from "./profile.svelte";

/** Annual amount a goal's contribution adds up to (0 if none). */
function annualContribution(g: GoalRow): Money {
  return g.contribution ? annualizeItem({ amount: Money.of(g.contribution), cadence: g.cadence }) : Money.zero();
}

/** Which stage a goal is at. */
export type GoalPhase = "done" | "active" | "paused";

/**
 * Savings goals as a list of sinking funds. Any number can be funded at once:
 * each goal carries its own `active` flag, and every active, incomplete goal's
 * contribution flows into the plan. Pausing one keeps its target and progress
 * but stops it claiming the pool. Sort order is display sequence only.
 * Optimistic writes so it works even if the DB is slow.
 */
class GoalsStore {
  rows = $state<GoalRow[]>([]);
  error = $state<string | null>(null);

  status(g: GoalRow): GoalStatus {
    // The engine works in months; convert whatever cadence to a monthly figure.
    // Pass the exact Decimal 1/12 — never String(1 / 12) (a float artifact, F5).
    const monthly = g.contribution ? annualContribution(g).multiply(new MoneyDecimal(1).div(12)) : null;
    return goalStatus({
      target: Money.of(g.targetAmount),
      saved: Money.of(g.savedAmount),
      ...(monthly ? { monthlyContribution: monthly } : {}),
      ...(g.targetMonths ? { targetMonths: g.targetMonths } : {}),
    });
  }

  /**
   * Set (or clear) a goal's timeline. Whole months only, and never zero — a
   * zero-month timeline has no meaningful required contribution, so an empty or
   * junk box clears the timeline instead of storing one.
   */
  setTimeline(id: string, months: number | null): void {
    const g = this.rows.find((r) => r.id === id);
    if (!g) return;
    const clean = months !== null && Number.isFinite(months) && months >= 1 ? Math.round(months) : null;
    this.save({ ...g, targetMonths: clean });
  }

  /** Annualized contribution for a goal (for readouts and the budget drill-down). */
  annual(g: GoalRow): Money {
    return annualContribution(g);
  }

  private complete(g: GoalRow): boolean {
    return Money.of(g.savedAmount).compare(Money.of(g.targetAmount)) >= 0;
  }

  /** Every goal currently funded — active, switched on, and not yet reached. */
  get activeGoals(): GoalRow[] {
    return this.rows.filter((g) => g.active && !this.complete(g));
  }

  phase(g: GoalRow): GoalPhase {
    if (this.complete(g)) return "done";
    return g.active ? "active" : "paused";
  }

  /** Switch a goal's funding on or off. A reached goal claims nothing either way. */
  toggleActive(id: string): void {
    const g = this.rows.find((r) => r.id === id);
    if (g) this.save({ ...g, active: !g.active });
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  /**
   * Every active goal claims the savings pool at once. Nothing is capped here:
   * if the total outruns what's left after bills, the plan goes negative and the
   * budget's over-committed path says so — the app reports what you've committed
   * to rather than quietly shrinking a contribution you entered.
   */
  private syncPlan(): void {
    profile.annualGoalContributions = this.activeGoals.reduce((sum, g) => sum.add(annualContribution(g)), Money.zero());
  }

  async load(): Promise<void> {
    try {
      this.rows = await loadGoals();
    } catch (e) {
      this.fail(e);
    }
    this.syncPlan();
  }

  save(g: GoalRow): void {
    const i = this.rows.findIndex((r) => r.id === g.id);
    if (i >= 0) this.rows[i] = g;
    else this.rows = [...this.rows, g];
    this.reindex();
    this.syncPlan();
    saveGoal(g).catch((e) => this.fail(e));
  }

  remove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.reindex();
    this.syncPlan();
    deleteGoal(id).catch((e) => this.fail(e));
  }

  /** The next sort_order for a new goal (append to the end of the list). */
  get nextOrder(): number {
    return this.rows.reduce((max, g) => Math.max(max, g.sortOrder), -1) + 1;
  }

  /** Move a goal up (-1) or down (+1) in the list. */
  reorder(id: string, dir: -1 | 1): void {
    const i = this.rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.rows.length) return;
    const rows = [...this.rows];
    [rows[i], rows[j]] = [rows[j], rows[i]];
    this.rows = rows;
    this.persistOrder();
    this.syncPlan();
  }

  /** Rewrite sortOrder to match array position and persist any that changed. */
  private reindex(): void {
    this.rows = this.rows.map((g, idx) => (g.sortOrder === idx ? g : { ...g, sortOrder: idx }));
  }

  private persistOrder(): void {
    this.rows = this.rows.map((g, idx) => ({ ...g, sortOrder: idx }));
    for (const g of this.rows) saveGoal(g).catch((e) => this.fail(e));
  }

  /** Add to a goal's saved amount. */
  contribute(id: string, amount: number): void {
    const g = this.rows.find((r) => r.id === id);
    if (!g || amount <= 0) return;
    const saved = Money.of(g.savedAmount).add(Money.of(String(amount)));
    this.save({ ...g, savedAmount: saved.toString() });
  }
}

export const goals = new GoalsStore();
