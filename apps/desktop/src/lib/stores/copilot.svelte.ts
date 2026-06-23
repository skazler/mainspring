import { applyCopilotCommand } from "@mainspring/engine";
import { copilotCommand } from "@mainspring/schema";
import { BUCKET_OPTIONS } from "$lib/buckets";
import { anthropicMessage } from "$lib/bridge/invoke";
import { loadApiKey, saveApiKey } from "$lib/db";
import { profile } from "./profile.svelte";

const BUCKETS = BUCKET_OPTIONS.map((o) => o.bucket);
const BASES = ["gross", "net", "post_tax_savings"] as const;

const SYSTEM = `You translate a natural-language request into allocation-dial adjustments for a personal FIRE (financial independence) planner.
- Only adjust allocation percentages. Each adjustment sets a dial's fraction of its base.
- pct is a decimal STRING in [0,1] (e.g. "0.15" for 15%).
- Only use buckets and bases from the provided lists. Do not invent new ones.
- You receive only the user's current dial percentages — never their balances or income. Reason about percentages only.
- Return the structured command. Use "note" for a one-line plain explanation.`;

// JSON-schema for structured output (mirrors @mainspring/schema copilotCommand).
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    adjustments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          bucket: { type: "string", enum: BUCKETS },
          base: { type: "string", enum: BASES },
          pct: { type: "string" },
        },
        required: ["bucket", "base", "pct"],
      },
    },
    note: { type: "string" },
  },
  required: ["adjustments"],
};

function buildBody(request: string): string {
  const currentDials = profile.dials.map((d) => ({ bucket: d.bucket, base: d.base, pct: d.pct }));
  const userContent = [
    `Available buckets: ${BUCKETS.join(", ")}`,
    `Available bases: ${BASES.join(", ")}`,
    `Current dials: ${JSON.stringify(currentDials)}`,
    `Request: ${request}`,
  ].join("\n");

  return JSON.stringify({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: userContent }],
  });
}

/** Natural-language → validated dial adjustments the engine applies. */
class CopilotStore {
  apiKey = $state("");
  request = $state("");
  running = $state(false);
  error = $state<string | null>(null);
  note = $state<string | null>(null);

  async loadKey(): Promise<void> {
    this.apiKey = await loadApiKey();
  }

  async run(): Promise<void> {
    if (!this.apiKey.trim()) {
      this.error = "Set your Anthropic API key first.";
      return;
    }
    if (!this.request.trim()) return;
    this.running = true;
    this.error = null;
    this.note = null;
    try {
      await saveApiKey(this.apiKey);
      const raw = await anthropicMessage(this.apiKey, buildBody(this.request));
      const resp = JSON.parse(raw) as {
        type?: string;
        error?: { message?: string };
        content?: { type: string; text?: string }[];
      };
      if (resp.type === "error") throw new Error(resp.error?.message ?? "API error");
      const text = resp.content?.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("No structured output returned.");
      const command = copilotCommand.parse(JSON.parse(text));
      profile.dials = applyCopilotCommand(profile.dials, command);
      this.note = command.note ?? "Applied.";
      this.request = "";
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.running = false;
    }
  }
}

export const copilot = new CopilotStore();
