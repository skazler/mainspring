import type { Bucket, DialBase } from "@mainspring/schema";

export interface BucketMeta {
  bucket: Bucket;
  label: string;
  base: DialBase;
  /** Reduces taxable income (traditional/pre-tax). Roth & taxable are false. */
  preTax: boolean;
  /** IRS annual cap in dollars, if the bucket is capped. */
  cap?: string;
  defaultEnabled?: boolean;
  defaultPercent?: number;
}

/** The contribution buckets offered in setup, with sensible defaults. */
export const BUCKET_OPTIONS: BucketMeta[] = [
  { bucket: "401k_pretax", label: "401(k) — pre-tax", base: "gross", preTax: true, cap: "24500", defaultEnabled: true, defaultPercent: 15 },
  { bucket: "ira", label: "IRA (traditional)", base: "gross", preTax: true, cap: "7500", defaultEnabled: true, defaultPercent: 5 },
  { bucket: "hsa", label: "HSA", base: "gross", preTax: true, cap: "4400" },
  { bucket: "roth_401k", label: "Roth 401(k)", base: "gross", preTax: false, cap: "24500" },
  { bucket: "roth_ira", label: "Roth IRA", base: "gross", preTax: false, cap: "7500" },
  { bucket: "brokerage", label: "Brokerage", base: "post_tax_savings", preTax: false, defaultEnabled: true, defaultPercent: 30 },
];

const LABELS = new Map(BUCKET_OPTIONS.map((o) => [o.bucket, o.label]));
const PRETAX = new Set(BUCKET_OPTIONS.filter((o) => o.preTax).map((o) => o.bucket));

/** Human label for a bucket key (falls back to the key). */
export function bucketLabel(bucket: string): string {
  return LABELS.get(bucket as Bucket) ?? bucket;
}

/** Whether a bucket's contributions reduce taxable income. */
export function isPreTax(bucket: string): boolean {
  return PRETAX.has(bucket as Bucket);
}
