import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { computeSelfEmploymentTax, computeTax, getTaxConstants } from "../../src/index";

/**
 * Self-employment tax goldens — single filer, Texas, 2026 constants. Worked by
 * hand below (Schedule SE): net earnings = profit × 92.35%; SS 12.4% up to what
 * wages left of the 184,500 wage base; Medicare 2.9%; Additional Medicare 0.9%
 * over 200,000 less wages; half of (SS + Medicare) deducted from taxable income.
 */
const m = (v: string) => Money.of(v);
const fica = getTaxConstants(2026).fica;

describe("computeSelfEmploymentTax", () => {
  it("charges both halves of FICA on 92.35% of profit, with no wages", () => {
    // NE 18,470 · SS 18,470×.124 = 2,290.28 · Medicare 18,470×.029 = 535.63
    const se = computeSelfEmploymentTax(m("20000"), Money.zero(), "single", fica);
    expect(se.netEarnings.toString()).toBe("18470.0000");
    expect(se.socialSecurity.toString()).toBe("2290.2800");
    expect(se.medicare.toString()).toBe("535.6300");
    expect(se.additionalMedicare.toString()).toBe("0.0000");
    expect(se.total.toString()).toBe("2825.9100");
    expect(se.deduction.toString()).toBe("1412.9550");
  });

  it("lets W-2 wages use up the Social Security wage base first", () => {
    // room 184,500 − 180,000 = 4,500 → SS 4,500×.124 = 558 · Medicare 535.63
    const se = computeSelfEmploymentTax(m("20000"), m("180000"), "single", fica);
    expect(se.socialSecurity.toString()).toBe("558.0000");
    expect(se.total.toString()).toBe("1093.6300");
    expect(se.deduction.toString()).toBe("546.8150");
  });

  it("applies the Additional Medicare surtax over the wage-reduced threshold", () => {
    // wages 190k: no SS room · NE 46,175 · Medicare 1,339.075
    // threshold 200k − 190k = 10k → (46,175 − 10,000)×.009 = 325.575
    const se = computeSelfEmploymentTax(m("50000"), m("190000"), "single", fica);
    expect(se.socialSecurity.toString()).toBe("0.0000");
    expect(se.medicare.toString()).toBe("1339.0750");
    expect(se.additionalMedicare.toString()).toBe("325.5750");
    expect(se.total.toString()).toBe("1664.6500");
    // the surtax is not part of the deduction
    expect(se.deduction.toString()).toBe("669.5375");
  });

  it("owes nothing below $400 of net earnings", () => {
    // 400 × .9235 = 369.40 < 400
    const se = computeSelfEmploymentTax(m("400"), Money.zero(), "single", fica);
    expect(se.total.toString()).toBe("0.0000");
    expect(se.deduction.toString()).toBe("0.0000");
  });
});

describe("computeTax with self-employment income", () => {
  const base = { pretax: Money.zero(), filingStatus: "single" as const, state: "TX", taxYear: 2026 };

  it("side income alone: SE tax, then income tax on profit less half of it", () => {
    // taxable 20,000 − 1,412.955 − 16,100 = 2,487.045 → 10% = 248.7045
    const t = computeTax({ ...base, grossWages: Money.zero(), selfEmploymentIncome: m("20000") });
    expect(t.selfEmployment.toString()).toBe("2825.9100");
    expect(t.taxableIncome.toString()).toBe("2487.0450");
    expect(t.federal.toString()).toBe("248.7045");
    expect(t.fica.toString()).toBe("0.0000");
    expect(t.total.toString()).toBe("3074.6145");
    expect(t.net.toString()).toBe("16925.3855");
  });

  it("stacks on top of wages", () => {
    // taxable 200,000 − 546.815 − 16,100 = 183,353.185
    // federal 1,240 + 4,560 + 12,166 + 24%×77,653.185 (18,636.7644) = 36,602.7644
    // W-2 FICA 11,160 + 2,610 = 13,770 · SE 1,093.63
    const t = computeTax({ ...base, grossWages: m("180000"), selfEmploymentIncome: m("20000") });
    expect(t.taxableIncome.toString()).toBe("183353.1850");
    expect(t.federal.toString()).toBe("36602.7644");
    expect(t.fica.toString()).toBe("13770.0000");
    expect(t.selfEmployment.toString()).toBe("1093.6300");
    expect(t.total.toString()).toBe("51466.3944");
  });

  it("is unchanged when there is no SE income", () => {
    const a = computeTax({ ...base, grossWages: m("100000") });
    const b = computeTax({ ...base, grossWages: m("100000"), selfEmploymentIncome: Money.zero() });
    expect(b.total.toString()).toBe(a.total.toString());
    expect(b.selfEmployment.toString()).toBe("0.0000");
  });
});
