import type { CopilotCommand } from "@mainspring/schema";
import { constrainPct, remainingPct } from "./allocation/constraints";
import type { DialInput } from "./types";

/**
 * Apply a validated AI-copilot command to a dial set. Pure: each adjustment sets
 * an existing dial's pct (or adds a new dial), clamped so a shared base never
 * exceeds 100% — the engine is the final authority over what the LLM proposed.
 */
export function applyCopilotCommand(dials: readonly DialInput[], command: CopilotCommand): DialInput[] {
  const next: DialInput[] = dials.map((d) => ({ ...d }));

  for (const adj of command.adjustments) {
    const i = next.findIndex((d) => d.bucket === adj.bucket && d.base === adj.base);
    if (i >= 0) {
      next[i] = { ...next[i]!, pct: constrainPct(adj.pct, remainingPct(next, adj.base, i)) };
    } else {
      const priority = next.reduce((max, d) => Math.max(max, d.priority), 0) + 1;
      const pct = constrainPct(adj.pct, remainingPct(next, adj.base, -1));
      next.push({ bucket: adj.bucket, base: adj.base, pct, priority });
    }
  }

  return next;
}
