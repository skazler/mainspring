import { recompute } from "@mainspring/engine";
import { buildProfileState, type SetupForm } from "./setup-map";

/** A saved plan: a named snapshot of the setup form (dials + assumptions). */
export interface Scenario {
  id: string;
  name: string;
  form: SetupForm;
  createdAt: string;
}

/** Comparable deterministic metrics for a scenario — the diff columns. */
export interface ScenarioSummary {
  takeHome: number;
  savingsRate: number;
  fiAge: number | null;
  fiNumber: number;
}

/** Derive the comparison summary from a form. Pure (recompute is pure). */
export function scenarioSummary(form: SetupForm): ScenarioSummary {
  const v = recompute(buildProfileState(form));
  return {
    takeHome: Number(v.net.toString()),
    savingsRate: Number(v.savingsRate),
    fiAge: v.fire.fiAge,
    fiNumber: Number(v.fire.fiNumber.toString()),
  };
}
