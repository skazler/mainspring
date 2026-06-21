import { Money } from "@mainspring/schema";
import { describe, expect, it } from "vitest";
import { computeTax } from "../../src/index";

/**
 * Golden tax scenarios — hand-verified, single filer in Texas (state = 0),
 * 2026 constants. Each expected value is computed by hand below and must match
 * to the cent. A constants change requires a deliberate update here.
 *
 * 2026 single brackets: 10% ≤12,400 · 12% ≤50,400 · 22% ≤105,700 · 24% ≤201,775
 *                       32% ≤256,225 · 35% ≤640,600 · 37% >640,600
 * Standard deduction (single): 16,100
 * FICA: SS 6.2% to wage base 184,500 · Medicare 1.45% all + 0.9% over 200,000
 */

interface Golden {
  name: string;
  gross: string;
  pretax: string;
  // expected, to the cent
  taxableIncome: string;
  federal: string;
  socialSecurity: string;
  medicare: string;
  fica: string;
  state: string;
  total: string;
  net: string;
  effectiveRate: string;
  marginalRate: string;
}

const SCENARIOS: Golden[] = [
  {
    // taxable 33,900 → 10%·12,400=1,240 + 12%·21,500=2,580 = 3,820
    // SS 50,000·.062=3,100 · Medicare 50,000·.0145=725 → FICA 3,825
    name: "$50k, no pre-tax",
    gross: "50000",
    pretax: "0",
    taxableIncome: "33900.0000",
    federal: "3820.0000",
    socialSecurity: "3100.0000",
    medicare: "725.0000",
    fica: "3825.0000",
    state: "0.0000",
    total: "7645.0000",
    net: "42355.0000",
    effectiveRate: "0.152900",
    marginalRate: "0.12",
  },
  {
    // taxable 83,900 → 1,240 + 12%·38,000=4,560 + 22%·33,500=7,370 = 13,170
    // SS 6,200 · Medicare 1,450 → FICA 7,650
    name: "$100k, no pre-tax",
    gross: "100000",
    pretax: "0",
    taxableIncome: "83900.0000",
    federal: "13170.0000",
    socialSecurity: "6200.0000",
    medicare: "1450.0000",
    fica: "7650.0000",
    state: "0.0000",
    total: "20820.0000",
    net: "79180.0000",
    effectiveRate: "0.208200",
    marginalRate: "0.22",
  },
  {
    // pre-tax 24,500 → taxable 59,400 → 1,240 + 4,560 + 22%·9,000=1,980 = 7,780
    // FICA unchanged on gross → 7,650
    name: "$100k, $24.5k 401k pre-tax",
    gross: "100000",
    pretax: "24500",
    taxableIncome: "59400.0000",
    federal: "7780.0000",
    socialSecurity: "6200.0000",
    medicare: "1450.0000",
    fica: "7650.0000",
    state: "0.0000",
    total: "15430.0000",
    net: "84570.0000",
    effectiveRate: "0.154300",
    marginalRate: "0.22",
  },
  {
    // taxable 233,900 → 1,240+4,560+22%·55,300=12,166+24%·96,075=23,058+32%·32,125=10,280 = 51,304
    // SS capped: 184,500·.062=11,439 · Medicare 250,000·.0145=3,625 + 0.9%·50,000=450 → 4,075 → FICA 15,514
    name: "$250k, no pre-tax (SS cap + addl Medicare)",
    gross: "250000",
    pretax: "0",
    taxableIncome: "233900.0000",
    federal: "51304.0000",
    socialSecurity: "11439.0000",
    medicare: "4075.0000",
    fica: "15514.0000",
    state: "0.0000",
    total: "66818.0000",
    net: "183182.0000",
    effectiveRate: "0.267272",
    marginalRate: "0.32",
  },
];

describe("computeTax — golden scenarios (single, TX, 2026)", () => {
  for (const s of SCENARIOS) {
    it(s.name, () => {
      const r = computeTax({
        grossWages: Money.of(s.gross),
        pretax: Money.of(s.pretax),
        filingStatus: "single",
        state: "TX",
        taxYear: 2026,
      });
      expect(r.taxableIncome.toString()).toBe(s.taxableIncome);
      expect(r.federal.toString()).toBe(s.federal);
      expect(r.socialSecurity.toString()).toBe(s.socialSecurity);
      expect(r.medicare.toString()).toBe(s.medicare);
      expect(r.fica.toString()).toBe(s.fica);
      expect(r.state.toString()).toBe(s.state);
      expect(r.total.toString()).toBe(s.total);
      expect(r.net.toString()).toBe(s.net);
      expect(r.effectiveRate).toBe(s.effectiveRate);
      expect(r.marginalRate).toBe(s.marginalRate);
    });
  }
});

describe("computeTax — invariants & edges", () => {
  it("pre-tax dollars reduce federal but not FICA", () => {
    const base = computeTax({ grossWages: Money.of("100000"), pretax: Money.of("0"), filingStatus: "single", state: "TX", taxYear: 2026 });
    const deferred = computeTax({ grossWages: Money.of("100000"), pretax: Money.of("24500"), filingStatus: "single", state: "TX", taxYear: 2026 });
    expect(deferred.federal.compare(base.federal)).toBe(-1); // lower federal
    expect(deferred.fica.equals(base.fica)).toBe(true); // identical FICA
  });

  it("zero income yields zero tax and a zero effective rate", () => {
    const r = computeTax({ grossWages: Money.of("0"), pretax: Money.of("0"), filingStatus: "single", state: "TX", taxYear: 2026 });
    expect(r.total.isZero()).toBe(true);
    expect(r.net.isZero()).toBe(true);
    expect(r.effectiveRate).toBe("0.000000");
    expect(r.marginalRate).toBe("0");
  });

  it("TX has zero state tax; an unmodeled state throws rather than guess", () => {
    const r = computeTax({ grossWages: Money.of("100000"), pretax: Money.of("0"), filingStatus: "single", state: "TX", taxYear: 2026 });
    expect(r.state.isZero()).toBe(true);
    expect(() =>
      computeTax({ grossWages: Money.of("100000"), pretax: Money.of("0"), filingStatus: "single", state: "CA", taxYear: 2026 }),
    ).toThrow(/not modeled/);
  });

  it("an unknown tax year throws", () => {
    expect(() =>
      computeTax({ grossWages: Money.of("100000"), pretax: Money.of("0"), filingStatus: "single", state: "TX", taxYear: 1999 }),
    ).toThrow(/No tax constants/);
  });
});
