import { z } from "zod";
import { Money } from "./money";

/** A `Money` value — either an existing instance or a decimal string we lift into one. */
export const zMoney = z.union([
  z.custom<Money>((v) => v instanceof Money, "expected a Money value"),
  z.string().refine((s) => /^-?\d+(\.\d+)?$/.test(s), "expected a decimal string").transform((s) => Money.of(s)),
]);

/** A rate / percentage in [0,1], kept as an exact decimal string. */
export const zRate = z
  .string()
  .refine((s) => /^\d(\.\d+)?$/.test(s) && Number(s) >= 0 && Number(s) <= 1, "expected a rate in [0,1]");

// ── enums (the allowed-value sets noted in the ER diagram) ─────────
export const frequency = z.enum(["weekly", "biweekly", "monthly", "annual"]);
export const filingStatus = z.enum(["single", "mfj", "mfs", "hoh"]);
export const bucket = z.enum([
  "401k_pretax",
  "roth_401k",
  "ira",
  "hsa",
  "brokerage",
  "emergency",
  "sinking",
  "cash",
]);
export const dialBase = z.enum(["gross", "net", "post_tax_savings"]);
export const lotSide = z.enum(["buy", "sell"]);
export const lotMethod = z.enum(["fifo", "specific-id"]);
export const accountKind = z.enum([
  "401k",
  "roth_ira",
  "trad_ira",
  "hsa",
  "brokerage",
  "savings",
  "checking",
]);

// Inferred enum types — the shared vocabulary consumed by the engine + UI.
export type Frequency = z.infer<typeof frequency>;
export type FilingStatus = z.infer<typeof filingStatus>;
export type Bucket = z.infer<typeof bucket>;
export type DialBase = z.infer<typeof dialBase>;
export type AccountKind = z.infer<typeof accountKind>;
export type LotSide = z.infer<typeof lotSide>;
export type LotMethod = z.infer<typeof lotMethod>;

/**
 * AI assistant output — a structured, Zod-validated reply plus optional dial
 * adjustments the engine applies. The model answers plan questions and may
 * propose changes; raw account data never leaves the device (docs/AI_WORKFLOWS.md).
 */
export const dialAdjustment = z.object({
  bucket,
  base: dialBase,
  pct: zRate,
});
export const assistantResponse = z.object({
  reply: z.string(),
  adjustments: z.array(dialAdjustment).optional(),
});
export type DialAdjustment = z.infer<typeof dialAdjustment>;
export type AssistantResponse = z.infer<typeof assistantResponse>;

// ── insert validators (what the engine/UI hand to the DB) ─────────
export const profileInsert = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().min(1),
  birthDate: z.string(), // ISO date
  targetRetireAge: z.number().int().positive(),
  annualExpenses: zMoney,
  swr: zRate,
});

export const incomeSourceInsert = z.object({
  id: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  label: z.string().min(1),
  grossAmount: zMoney,
  frequency,
  isW2: z.boolean(),
});

export const taxProfileInsert = z.object({
  profileId: z.string().uuid(),
  filingStatus,
  state: z.string().length(2),
  taxYear: z.number().int(),
});

export const dialInsert = z.object({
  id: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  bucket,
  pct: zRate,
  base: dialBase,
  priority: z.number().int(),
  annualCap: zMoney.nullable().optional(),
});

export const accountInsert = z.object({
  id: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  kind: accountKind,
  taxAdvantaged: z.boolean(),
  balance: zMoney,
});

export const lotInsert = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  ticker: z.string().min(1),
  side: lotSide,
  tradeDate: z.string(), // ISO date
  shares: z.string(),
  price: zMoney,
  fee: zMoney.optional(),
  closesLotId: z.string().uuid().nullable().optional(),
});

export const spendingInsert = z.object({
  id: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  category: z.string().min(1),
  label: z.string().nullable().optional(),
  amount: zMoney,
  spentAt: z.string(), // ISO date
});

export const holdingInsert = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  ticker: z.string().min(1),
  shares: z.string(),
  costBasis: zMoney,
});
