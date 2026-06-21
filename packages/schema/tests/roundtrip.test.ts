import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Money, accounts, profiles, schema } from "../src/index";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

async function freshDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}

describe("PGlite migration + exact-decimal round-trip", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeAll(async () => {
    db = await freshDb();
  });

  it("applies the migration (profiles table exists and is empty)", async () => {
    const rows = await db.select().from(profiles);
    expect(rows).toEqual([]);
  });

  it("round-trips a profile with an awkward exact decimal", async () => {
    const [p] = await db
      .insert(profiles)
      .values({
        displayName: "Texas FIRE",
        birthDate: "1990-03-14",
        targetRetireAge: 50,
        annualExpenses: Money.of("65432.1987"), // every 4 decimal places significant
        swr: "0.0400",
      })
      .returning();

    expect(p).toBeDefined();
    // comes back as a Money, exact to the cent-of-a-cent
    expect(p!.annualExpenses).toBeInstanceOf(Money);
    expect(p!.annualExpenses.toString()).toBe("65432.1987");
    expect(p!.annualExpenses.equals(Money.of("65432.1987"))).toBe(true);
    expect(p!.swr).toBe("0.0400");
  });

  it("round-trips accounts whose balances sum exactly", async () => {
    const [p] = await db
      .insert(profiles)
      .values({
        displayName: "Accounts owner",
        birthDate: "1985-01-01",
        targetRetireAge: 55,
        annualExpenses: Money.of("40000.0000"),
        swr: "0.0350",
      })
      .returning();

    const balances = ["12345.6789", "0.0001", "999999.9999"];
    await db.insert(accounts).values(
      balances.map((b, i) => ({
        profileId: p!.id,
        kind: i === 0 ? ("brokerage" as const) : ("savings" as const),
        taxAdvantaged: false,
        balance: Money.of(b),
      })),
    );

    const rows = await db.select().from(accounts).where(eq(accounts.profileId, p!.id));
    expect(rows).toHaveLength(3);

    const readBack = rows.map((r) => r.balance.toString()).sort();
    expect(readBack).toEqual([...balances].sort());

    // sum is exact — no float drift
    const total = rows.reduce((acc, r) => acc.add(r.balance), Money.zero());
    expect(total.toString()).toBe("1012345.6789");
  });
});

describe("Money value object", () => {
  it("refuses to be built from a float at runtime", () => {
    // @ts-expect-error — passing a number is a type error AND a runtime throw
    expect(() => Money.of(123.45)).toThrow(TypeError); // eslint-disable-line mainspring/no-float-money -- exercising the runtime guard
  });

  it("allocate is penny-safe (parts sum back to the whole)", () => {
    const parts = Money.of("100.0000").allocate(["1", "1", "1"]); // 100 / 3
    const sum = parts.reduce((a, b) => a.add(b), Money.zero());
    expect(sum.toString()).toBe("100.0000");
    // one part absorbs the leftover 1/10000 unit
    expect(parts.map((p) => p.toString()).sort()).toEqual(["33.3333", "33.3333", "33.3334"]);
  });

  it("keeps full precision mid-calc, rounds HALF_UP only at the boundary", () => {
    const taxed = Money.of("100000").multiply("0.123456"); // 12345.6
    expect(taxed.toString()).toBe("12345.6000");
  });
});
