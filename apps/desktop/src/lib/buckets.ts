import type { Bucket, DialBase } from "@mainspring/schema";

export interface BucketMeta {
  bucket: Bucket;
  label: string;
  base: DialBase;
  /** IRS annual cap in dollars, if the bucket is capped. */
  cap?: string;
  defaultEnabled?: boolean;
  defaultPercent?: number;
}

/** The contribution buckets offered in setup, with sensible defaults. */
export const BUCKET_OPTIONS: BucketMeta[] = [
  { bucket: "401k_pretax", label: "401(k) — pre-tax", base: "gross", cap: "24500", defaultEnabled: true, defaultPercent: 15 },
  { bucket: "roth_401k", label: "Roth 401(k)", base: "gross", cap: "24500" },
  { bucket: "ira", label: "IRA (traditional)", base: "gross", cap: "7500", defaultEnabled: true, defaultPercent: 5 },
  { bucket: "hsa", label: "HSA", base: "gross", cap: "4400" },
  { bucket: "brokerage", label: "Brokerage", base: "post_tax_savings", defaultEnabled: true, defaultPercent: 30 },
];

const LABELS = new Map(BUCKET_OPTIONS.map((o) => [o.bucket, o.label]));

/** Human label for a bucket key (falls back to the key). */
export function bucketLabel(bucket: string): string {
  return LABELS.get(bucket as Bucket) ?? bucket;
}
