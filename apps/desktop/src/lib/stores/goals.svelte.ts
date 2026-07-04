import { goalStatus, type GoalStatus } from "@mainspring/engine";
import { Money } from "@mainspring/schema";
import { deleteGoal, loadGoals, saveGoal, type GoalRow } from "$lib/db";

const today = () => new Date().toISOString().slice(0, 10);

/** Savings goals / sinking funds. Optimistic writes so it works even if the DB is slow. */
class GoalsStore {
  rows = $state<GoalRow[]>([]);
  error = $state<string | null>(null);

  status(g: GoalRow): GoalStatus {
    return goalStatus(
      {
        target: Money.of(g.targetAmount),
        saved: Money.of(g.savedAmount),
        ...(g.monthlyContribution ? { monthlyContribution: Money.of(g.monthlyContribution) } : {}),
        ...(g.targetDate ? { targetDate: g.targetDate } : {}),
      },
      today(),
    );
  }

  private fail(e: unknown): void {
    this.error = `Couldn't reach local storage — changes stay in memory this session. (${e instanceof Error ? e.message : String(e)})`;
  }

  async load(): Promise<void> {
    try {
      this.rows = await loadGoals();
    } catch (e) {
      this.fail(e);
    }
  }

  save(g: GoalRow): void {
    const i = this.rows.findIndex((r) => r.id === g.id);
    if (i >= 0) this.rows[i] = g;
    else this.rows = [...this.rows, g];
    saveGoal(g).catch((e) => this.fail(e));
  }

  remove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    deleteGoal(id).catch((e) => this.fail(e));
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
