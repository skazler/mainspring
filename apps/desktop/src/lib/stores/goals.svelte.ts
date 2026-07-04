import { annualizeItem, goalStatus, type GoalStatus } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteGoal, loadGoals, saveGoal, type GoalRow } from "$lib/db";
import { profile } from "./profile.svelte";

const today = () => new Date().toISOString().slice(0, 10);

/** Annual amount a goal's contribution adds up to (0 if none). */
function annualContribution(g: GoalRow): Money {
  return g.contribution ? annualizeItem({ amount: Money.of(g.contribution), cadence: g.cadence }) : Money.zero();
}

/** Which stage a goal is at in the checklist. */
export type GoalPhase = "done" | "active" | "planned";

/**
 * Savings goals as an ordered checklist. Goals fund one at a time: the first
 * incomplete goal (by sort order) is "active" and its monthly contribution flows
 * into the plan; later goals are "planned" (queued, not yet claiming the pool).
 * Optimistic writes so it works even if the DB is slow.
 */
class GoalsStore {
  rows = $state<GoalRow[]>([]);
  error = $state<string | null>(null);

  status(g: GoalRow): GoalStatus {
    // The engine works in months; convert whatever cadence to a monthly figure.
    const monthly = g.contribution ? annualContribution(g).multiply(String(1 / 12)) : null;
    return goalStatus(
      {
        target: Money.of(g.targetAmount),
        saved: Money.of(g.savedAmount),
        ...(monthly ? { monthlyContribution: monthly } : {}),
        ...(g.targetDate ? { targetDate: g.targetDate } : {}),
      },
      today(),
    );
  }

  /** Annualized contribution for a goal (for readouts and the budget drill-down). */
  annual(g: GoalRow): Money {
    return annualContribution(g);
  }

  private complete(g: GoalRow): boolean {
    return Money.of(g.savedAmount).compare(Money.of(g.targetAmount)) >= 0;
  }

  /** The first incomplete goal in order — the one currently being funded. */
  get activeId(): string | null {
    return this.rows.find((g) => !this.complete(g))?.id ?? null;
  }

  phase(g: GoalRow): GoalPhase {
    if (this.complete(g)) return "done";
    return g.id === this.activeId ? "active" : "planned";
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  /** Only the active goal claims the savings pool; planned goals wait their turn. */
  private syncPlan(): void {
    const active = this.rows.find((g) => g.id === this.activeId);
    profile.annualGoalContributions = active ? annualContribution(active) : Money.zero();
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

  /** The next sort_order for a new goal (append to the end of the checklist). */
  get nextOrder(): number {
    return this.rows.reduce((max, g) => Math.max(max, g.sortOrder), -1) + 1;
  }

  /** Move a goal up (-1) or down (+1) in the checklist. */
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
