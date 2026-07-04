import { applyDialAdjustments } from "@mainspring/engine";
import { assistantResponse } from "@mainspring/schema";
import { BUCKET_OPTIONS } from "$lib/buckets";
import { anthropicMessage } from "$lib/bridge/invoke";
import { loadApiKey, saveApiKey } from "$lib/db";
import { profile } from "./profile.svelte";
import { view } from "./derived.svelte";

const BUCKETS = BUCKET_OPTIONS.map((o) => o.bucket);
const BASES = ["gross", "net", "post_tax_savings"] as const;

const SYSTEM = `You are a financial-independence (FIRE) planning assistant inside a private desktop app, in an ongoing chat.
- Answer the user's questions about their plan clearly and concisely.
- If (and only if) they ask to change their allocations, include "adjustments": each sets a dial's fraction of its base (pct is a decimal STRING in [0,1]). Use only the listed buckets/bases.
- You receive only allocation percentages and derived ratios/ages — never the user's actual income, balances, or dollar amounts. Don't claim to know dollar figures.
- This is informational, not financial advice. Always put your answer in "reply".`;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
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
  },
  required: ["reply"],
};

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function buildBody(history: ChatMessage[]): string {
  const v = view.current;
  const context = {
    dials: profile.dials.map((d) => ({ bucket: d.bucket, base: d.base, pct: d.pct })),
    metrics: {
      savingsRate: v.savingsRate,
      fiAge: v.fire.fiAge,
      yearsToFI: v.fire.yearsToFI,
      alreadyFI: v.fire.alreadyFI,
      effectiveTaxRate: v.tax.effectiveRate,
      marginalTaxRate: v.tax.marginalRate,
    },
  };
  const system = `${SYSTEM}

Available buckets: ${BUCKETS.join(", ")}
Available bases: ${BASES.join(", ")}
Current plan context (ratios/ages only): ${JSON.stringify(context)}`;

  return JSON.stringify({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system,
    output_config: { format: { type: "json_schema", schema } },
    messages: history.map((m) => ({ role: m.role, content: m.text })),
  });
}

/** A collapsible planning-assistant chat: answers questions, may apply validated dial changes. */
class AlmanacStore {
  apiKey = $state("");
  request = $state("");
  running = $state(false);
  error = $state<string | null>(null);
  messages = $state<ChatMessage[]>([]);

  async loadKey(): Promise<void> {
    this.apiKey = await loadApiKey();
  }

  async ask(): Promise<void> {
    if (!this.apiKey.trim()) {
      this.error = "Set your Anthropic API key first.";
      return;
    }
    const q = this.request.trim();
    if (!q || this.running) return;
    this.request = "";
    this.error = null;
    this.messages = [...this.messages, { role: "user", text: q }];
    this.running = true;
    try {
      await saveApiKey(this.apiKey);
      const raw = await anthropicMessage(this.apiKey, buildBody(this.messages));
      const resp = JSON.parse(raw) as {
        type?: string;
        error?: { message?: string };
        content?: { type: string; text?: string }[];
      };
      if (resp.type === "error") throw new Error(resp.error?.message ?? "API error");
      const text = resp.content?.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("No structured output returned.");
      const answer = assistantResponse.parse(JSON.parse(text));
      const applied = answer.adjustments?.length ?? 0;
      const suffix = applied ? ` (applied ${applied} dial change${applied === 1 ? "" : "s"})` : "";
      this.messages = [...this.messages, { role: "assistant", text: answer.reply + suffix }];
      if (answer.adjustments?.length) {
        profile.dials = applyDialAdjustments(profile.dials, answer.adjustments);
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.running = false;
    }
  }
}

export const almanac = new AlmanacStore();
