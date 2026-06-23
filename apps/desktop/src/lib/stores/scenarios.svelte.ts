import { deleteScenario, listScenarios, saveScenario } from "$lib/db";
import type { Scenario } from "$lib/scenario";
import { buildProfileState } from "$lib/setup-map";
import { applySetup } from "./profile.svelte";
import { setupForm } from "./setup-form.svelte";

/** Save / load / compare named plans (Phase 7). */
class ScenariosStore {
  items = $state<Scenario[]>([]);
  /** Scenario ids selected for side-by-side comparison. */
  selected = $state<string[]>([]);

  async load(): Promise<void> {
    this.items = await listScenarios();
  }

  /** Snapshot the current setup as a new named scenario. */
  async saveCurrent(name: string): Promise<void> {
    const form = JSON.parse(JSON.stringify(setupForm)) as typeof setupForm;
    const scenario: Scenario = {
      id: crypto.randomUUID(),
      name: name.trim() || `Plan ${this.items.length + 1}`,
      form,
      createdAt: new Date().toISOString(),
    };
    await saveScenario(scenario);
    await this.load();
  }

  /** Apply a saved scenario to the live profile + setup form. */
  apply(s: Scenario): void {
    Object.assign(setupForm, JSON.parse(JSON.stringify(s.form)));
    applySetup(buildProfileState(s.form));
  }

  async remove(id: string): Promise<void> {
    await deleteScenario(id);
    this.selected = this.selected.filter((x) => x !== id);
    await this.load();
  }

  toggleSelect(id: string): void {
    this.selected = this.selected.includes(id)
      ? this.selected.filter((x) => x !== id)
      : [...this.selected, id];
  }
}

export const scenarios = new ScenariosStore();
