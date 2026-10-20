import { describe, expect, it } from "vitest";

import {
  applyPromo,
  calculateQuote,
  convertCents,
  type PricingCatalog,
  type QuoteInput,
} from "./engine";

const TIERS = ["Iron", "Bronze", "Silver", "Gold"] as const;
const DIVISIONS = ["IV", "III", "II", "I"] as const;
const TIER_PRICES = { Iron: 500, Bronze: 600, Silver: 800, Gold: 1100 } as const;

/** Iron IV (0) ... Gold I (15), Master (16, top). Same shape as the seeded LoL ladder. */
const tiered: PricingCatalog = {
  slug: "lol",
  name: "League of Legends",
  rankSystem: "DIVISION",
  orderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
  basePriceCents: 0,
  coachingHourlyCents: 2000,
  steps: [
    ...TIERS.flatMap((tier) =>
      DIVISIONS.map((division) => ({
        tier,
        division,
        divisionPriceCents: TIER_PRICES[tier],
        winPriceCents: 400,
        placementPriceCents: 500,
      })),
    ),
    { tier: "Master", division: null, divisionPriceCents: null, winPriceCents: 1500, placementPriceCents: 1800 },
  ].map((step, position) => ({ ...step, position })),
  brackets: [],
  servers: [
    { code: "EUW", name: "Europe West", region: "EU", percentBp: 0 },
    { code: "NA", name: "North America", region: "NA", percentBp: 1000 },
  ],
  modifiers: [
    { key: "normal_lp", label: "Normal", description: null, category: "LP_GAIN", percentBp: 0, orderTypes: ["DIVISION"], isDefault: true },
    { key: "low_lp", label: "Low", description: null, category: "LP_GAIN", percentBp: 2000, orderTypes: ["DIVISION"], isDefault: false },
    { key: "smurf_queue", label: "Smurf", description: null, category: "LP_GAIN", percentBp: -1000, orderTypes: ["DIVISION"], isDefault: false },
    { key: "priority", label: "Priority", description: null, category: "ADD_ON", percentBp: 2000, orderTypes: ["DIVISION", "WIN", "PLACEMENT"], isDefault: false },
    { key: "live_stream", label: "Stream", description: null, category: "ADD_ON", percentBp: 2500, orderTypes: [], isDefault: false },
  ],
};

const rating: PricingCatalog = {
  ...tiered,
  slug: "cs2",
  rankSystem: "RATING",
  orderTypes: ["DIVISION", "WIN", "COACHING"],
  steps: [],
  brackets: [
    { minRating: 0, maxRating: 5000, pricePer100Cents: 150, winPriceCents: 200 },
    { minRating: 5000, maxRating: 10000, pricePer100Cents: 250, winPriceCents: 300 },
    { minRating: 10000, maxRating: 15000, pricePer100Cents: 400, winPriceCents: 400 },
  ],
  modifiers: tiered.modifiers.filter((modifier) => modifier.category === "ADD_ON"),
};

const input = (patch: Partial<QuoteInput>): QuoteInput => ({
  orderType: "DIVISION",
  current: 12, // Gold IV
  target: 16, // Master
  currentPoints: "0-20",
  quantity: 5,
  server: "EUW",
  lpGain: "normal_lp",
  addOns: [],
  ...patch,
});

function subtotal(catalog: PricingCatalog, patch: Partial<QuoteInput>) {
  const result = calculateQuote(catalog, input(patch));
  if (!result.ok) throw new Error(result.error);
  return result.quote.subtotalCents;
}

describe("division boost on a tiered ladder", () => {
  it("sums the division prices between current and desired rank", () => {
    expect(subtotal(tiered, {})).toBe(4 * 1100); // Gold IV -> Master
    expect(subtotal(tiered, { current: 2, target: 6 })).toBe(500 + 500 + 600 + 600); // Iron II -> Bronze II
  });

  it("matches the seeded example order ELO-10001: Gold IV -> Plat IV +20% priority", () => {
    expect(subtotal(tiered, { addOns: ["priority"] })).toBe(5280);
  });

  it("adds server, LP gain and add-on percentages to the same base", () => {
    // 4400 base: +10% NA, +20% low LP, +20% priority, +25% stream = +75%
    expect(subtotal(tiered, { server: "NA", lpGain: "low_lp", addOns: ["priority", "live_stream"] })).toBe(7700);
  });

  it("supports negative modifiers (smurf queue)", () => {
    expect(subtotal(tiered, { lpGain: "smurf_queue" })).toBe(3960);
  });

  it("discounts only the first division by the LP/RR already earned", () => {
    // first Gold division 1100 at -60% = 440, then 3 × 1100
    expect(subtotal(tiered, { currentPoints: "81-100" })).toBe(440 + 3300);
  });

  it("rejects a desired rank that is not above the current one", () => {
    expect(calculateQuote(tiered, input({ target: 12 }))).toEqual({ ok: false, error: "target_not_above_current" });
    expect(calculateQuote(tiered, input({ target: 3 }))).toEqual({ ok: false, error: "target_not_above_current" });
  });

  it("rejects ranks outside the ladder", () => {
    expect(calculateQuote(tiered, input({ target: 17 }))).toEqual({ ok: false, error: "invalid_rank" });
    expect(calculateQuote(tiered, input({ current: -1 }))).toEqual({ ok: false, error: "invalid_rank" });
    expect(calculateQuote(tiered, input({ current: 1.5 }))).toEqual({ ok: false, error: "invalid_rank" });
  });
});

describe("division boost on a rating game", () => {
  it("prices each rating band separately", () => {
    // 9000 -> 12000: 1000 pts @ 2.50/100 + 2000 pts @ 4.00/100
    expect(subtotal(rating, { current: 9000, target: 12000, lpGain: null })).toBe(2500 + 8000);
  });

  it("handles a range inside one band and partial hundreds", () => {
    expect(subtotal(rating, { current: 1000, target: 1050, lpGain: null })).toBe(75);
  });

  it("rejects ratings above the last band", () => {
    expect(calculateQuote(rating, input({ current: 9000, target: 15100, lpGain: null }))).toEqual({
      ok: false,
      error: "invalid_rank",
    });
  });
});

describe("wins, placements and coaching", () => {
  it("prices wins at the current rank or band", () => {
    expect(subtotal(tiered, { orderType: "WIN", current: 16, quantity: 3 })).toBe(4500);
    expect(subtotal(rating, { orderType: "WIN", current: 15000, quantity: 2, lpGain: null })).toBe(800);
  });

  it("prices placements on tiered games and refuses them on rating games", () => {
    expect(subtotal(tiered, { orderType: "PLACEMENT", current: 15, quantity: 5 })).toBe(2500);
    expect(calculateQuote({ ...rating, orderTypes: ["PLACEMENT"] }, input({ orderType: "PLACEMENT", lpGain: null }))).toEqual({
      ok: false,
      error: "order_type_unsupported",
    });
  });

  it("prices coaching per hour and only applies add-ons meant for it", () => {
    // priority is not offered for coaching and is dropped; stream applies to all types
    const result = calculateQuote(tiered, input({ orderType: "COACHING", quantity: 2, addOns: ["priority", "live_stream"] }));
    expect(result.ok && result.quote.subtotalCents).toBe(5000);
    expect(result.ok && result.quote.applied).toEqual({ lpGain: null, addOns: ["live_stream"] });
  });

  it("enforces quantity limits", () => {
    expect(calculateQuote(tiered, input({ orderType: "WIN", quantity: 0 }))).toEqual({ ok: false, error: "invalid_quantity" });
    expect(calculateQuote(tiered, input({ orderType: "WIN", quantity: 21 }))).toEqual({ ok: false, error: "invalid_quantity" });
  });
});

describe("tampering", () => {
  it("rejects unknown servers and options instead of pricing them at zero", () => {
    expect(calculateQuote(tiered, input({ server: "MOON" }))).toEqual({ ok: false, error: "unknown_server" });
    expect(calculateQuote(tiered, input({ addOns: ["free_boost"] }))).toEqual({ ok: false, error: "unknown_option" });
    expect(calculateQuote(tiered, input({ lpGain: "minus_99" }))).toEqual({ ok: false, error: "unknown_option" });
  });

  it("rejects order types the game doesn't sell", () => {
    expect(calculateQuote(rating, input({ orderType: "PLACEMENT", lpGain: null }))).toEqual({
      ok: false,
      error: "order_type_unsupported",
    });
  });

  it("counts a repeated add-on only once", () => {
    expect(subtotal(tiered, { addOns: ["priority", "priority", "priority"] })).toBe(5280);
  });
});

describe("promo codes and currency", () => {
  it("applies percentage and fixed discounts", () => {
    expect(applyPromo(2500, { code: "WELCOME10", discountType: "PERCENTAGE", value: 1000, minSubtotalCents: null })).toEqual({
      ok: true,
      discountCents: 250,
      totalCents: 2250,
    });
    expect(applyPromo(300, { code: "SAVE5", discountType: "FIXED", value: 500, minSubtotalCents: null })).toEqual({
      ok: true,
      discountCents: 300,
      totalCents: 0,
    });
  });

  it("enforces the minimum order amount", () => {
    expect(applyPromo(2999, { code: "SAVE5", discountType: "FIXED", value: 500, minSubtotalCents: 3000 })).toEqual({
      ok: false,
      error: "promo_min_amount",
      minSubtotalCents: 3000,
    });
  });

  it("converts USD cents with the USD value of one unit", () => {
    expect(convertCents(11550, 1.08)).toBe(10694); // the seeded EUR order ELO-10004
    expect(convertCents(560, 0.029)).toBe(19310); // the seeded TRY order ELO-10006
  });
});
