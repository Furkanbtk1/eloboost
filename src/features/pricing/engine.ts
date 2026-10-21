/**
 * Price calculator engine. Pure and isomorphic: the browser runs it for the
 * live price, the server runs the exact same code to re-price every order, so
 * a tampered client can never choose its own price.
 *
 * Money is integer USD cents; percentages are basis points (1% = 100 bp).
 *
 * Formula
 *   base     = service price (see below) + game flat fee
 *   subtotal = base + Σ round(base × modifier%)   (server, LP gain, add-ons)
 *   total    = subtotal − promo discount
 *
 * Service price per order type
 *   DIVISION   tiered games: Σ division prices from current to desired rung,
 *              first rung reduced by the current LP/RR bucket discount
 *              rating games: Σ over price bands of (points in band / 100) × band price
 *   WIN        win price at the current rank (or band) × wins
 *   PLACEMENT  placement price at last season's rank × games (tiered games only)
 *   COACHING   hourly rate × hours
 */

import type { DiscountType, ModifierCategory, OrderType as DbOrderType, RankSystem } from "@/generated/prisma/enums";

/** Services priced by the calculator. Shop accounts (ACCOUNT) have fixed prices and never go through it. */
export type OrderType = Exclude<DbOrderType, "ACCOUNT">;

export const isBoostType = (value: DbOrderType): value is OrderType => value !== "ACCOUNT";

// ---------------------------------------------------------------------------
// Catalog (admin-editable price data, loaded from the database)
// ---------------------------------------------------------------------------

export type CatalogStep = {
  position: number;
  tier: string;
  division: string | null;
  /** Price to climb from this rung to the next; null on the top rung. */
  divisionPriceCents: number | null;
  winPriceCents: number;
  placementPriceCents: number;
};

export type CatalogBracket = {
  minRating: number;
  maxRating: number;
  pricePer100Cents: number;
  winPriceCents: number;
};

export type CatalogServer = { code: string; name: string; region: string; percentBp: number };

export type CatalogModifier = {
  key: string;
  label: string;
  description: string | null;
  category: ModifierCategory;
  percentBp: number;
  /** Order types it applies to; empty = all. */
  orderTypes: OrderType[];
  isDefault: boolean;
};

export type PricingCatalog = {
  slug: string;
  name: string;
  rankSystem: RankSystem;
  orderTypes: OrderType[];
  basePriceCents: number;
  coachingHourlyCents: number | null;
  /** Sorted by position, lowest first. */
  steps: CatalogStep[];
  /** Sorted by minRating, contiguous. */
  brackets: CatalogBracket[];
  /** Sorted for display; the first one is the default. */
  servers: CatalogServer[];
  modifiers: CatalogModifier[];
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Discount on the first division for LP/RR already earned in it. */
export const POINTS_BUCKETS = [
  { key: "0-20", discountBp: 0 },
  { key: "21-40", discountBp: 1500 },
  { key: "41-60", discountBp: 3000 },
  { key: "61-80", discountBp: 4500 },
  { key: "81-100", discountBp: 6000 },
] as const;

export type PointsBucket = (typeof POINTS_BUCKETS)[number]["key"];
export const POINTS_BUCKET_KEYS = POINTS_BUCKETS.map((bucket) => bucket.key) as [PointsBucket, ...PointsBucket[]];

export const QUANTITY_LIMITS = {
  WIN: { min: 1, max: 20, default: 5 },
  PLACEMENT: { min: 1, max: 10, default: 5 },
  COACHING: { min: 1, max: 10, default: 2 },
} as const satisfies Record<Exclude<OrderType, "DIVISION">, { min: number; max: number; default: number }>;

export type QuoteInput = {
  orderType: OrderType;
  /** Rank position (tiered games) or rating (rating games). Last season's rank for PLACEMENT. */
  current: number;
  /** Desired rank position / rating. DIVISION orders only. */
  target: number;
  /** LP/RR already earned in the current division. DIVISION orders on tiered games only. */
  currentPoints: PointsBucket;
  /** Wins, games or hours. WIN / PLACEMENT / COACHING only. */
  quantity: number;
  server: string;
  lpGain: string | null;
  addOns: string[];
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type QuoteError =
  | "order_type_unsupported"
  | "invalid_rank"
  | "target_not_above_current"
  | "invalid_quantity"
  | "unknown_server"
  | "unknown_option"
  | "coaching_unavailable";

export type QuoteModifierLine = {
  key: string;
  category: "SERVER" | ModifierCategory;
  percentBp: number;
  amountCents: number;
};

export type Quote = {
  /** Service price before the flat fee and modifiers. */
  serviceCents: number;
  flatFeeCents: number;
  baseCents: number;
  modifiers: QuoteModifierLine[];
  subtotalCents: number;
  /** The selection that was actually priced (irrelevant options dropped). */
  applied: { lpGain: string | null; addOns: string[] };
};

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: QuoteError };

const fail = (error: QuoteError): QuoteResult => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Helpers shared with the UI
// ---------------------------------------------------------------------------

export function maxPosition(catalog: PricingCatalog): number {
  return catalog.steps.length - 1;
}

export function maxRating(catalog: PricingCatalog): number {
  return catalog.brackets.at(-1)?.maxRating ?? 0;
}

export function stepLabel(step: Pick<CatalogStep, "tier" | "division">): string {
  return step.division ? `${step.tier} ${step.division}` : step.tier;
}

/** Modifiers of a category that apply to an order type. */
export function applicableModifiers(
  catalog: PricingCatalog,
  orderType: OrderType,
  category: ModifierCategory,
): CatalogModifier[] {
  return catalog.modifiers.filter(
    (modifier) =>
      modifier.category === category &&
      (modifier.orderTypes.length === 0 || modifier.orderTypes.includes(orderType)),
  );
}

function bracketAt(catalog: PricingCatalog, rating: number): CatalogBracket | undefined {
  // The top of the last band belongs to the last band.
  return (
    catalog.brackets.find((bracket) => rating >= bracket.minRating && rating < bracket.maxRating) ??
    (rating === maxRating(catalog) ? catalog.brackets.at(-1) : undefined)
  );
}

const isInt = (value: number) => Number.isInteger(value);

// ---------------------------------------------------------------------------
// Service price
// ---------------------------------------------------------------------------

function servicePrice(catalog: PricingCatalog, input: QuoteInput): number | QuoteError {
  const tiered = catalog.rankSystem === "DIVISION";

  switch (input.orderType) {
    case "DIVISION": {
      if (!isInt(input.current) || !isInt(input.target)) return "invalid_rank";

      if (tiered) {
        if (input.current < 0 || input.target > maxPosition(catalog)) return "invalid_rank";
        if (input.target <= input.current) return "target_not_above_current";

        let total = 0;
        for (let position = input.current; position < input.target; position++) {
          const price = catalog.steps[position]?.divisionPriceCents;
          if (price == null) return "invalid_rank";
          if (position === input.current) {
            const bucket = POINTS_BUCKETS.find((entry) => entry.key === input.currentPoints);
            if (!bucket) return "invalid_rank";
            total += Math.round((price * (10000 - bucket.discountBp)) / 10000);
          } else {
            total += price;
          }
        }
        return total;
      }

      if (input.current < 0 || input.target > maxRating(catalog)) return "invalid_rank";
      if (input.target <= input.current) return "target_not_above_current";
      // Σ points × (price per 100), divided once at the end to avoid rounding drift.
      let weighted = 0;
      for (const bracket of catalog.brackets) {
        const points = Math.min(input.target, bracket.maxRating) - Math.max(input.current, bracket.minRating);
        if (points > 0) weighted += points * bracket.pricePer100Cents;
      }
      return Math.round(weighted / 100);
    }

    case "WIN":
    case "PLACEMENT":
    case "COACHING": {
      const limits = QUANTITY_LIMITS[input.orderType];
      if (!isInt(input.quantity) || input.quantity < limits.min || input.quantity > limits.max) {
        return "invalid_quantity";
      }

      if (input.orderType === "COACHING") {
        return catalog.coachingHourlyCents == null ? "coaching_unavailable" : catalog.coachingHourlyCents * input.quantity;
      }

      if (!isInt(input.current)) return "invalid_rank";
      if (tiered) {
        const step = catalog.steps[input.current];
        if (!step) return "invalid_rank";
        const unit = input.orderType === "WIN" ? step.winPriceCents : step.placementPriceCents;
        return unit * input.quantity;
      }

      if (input.orderType === "PLACEMENT") return "order_type_unsupported";
      const bracket = bracketAt(catalog, input.current);
      return bracket ? bracket.winPriceCents * input.quantity : "invalid_rank";
    }
  }
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export function calculateQuote(catalog: PricingCatalog, input: QuoteInput): QuoteResult {
  if (!catalog.orderTypes.includes(input.orderType)) return fail("order_type_unsupported");

  const server = catalog.servers.find((entry) => entry.code === input.server);
  if (!server) return fail("unknown_server");

  // Options must exist for the game; ones that don't apply to this order
  // type (e.g. LP gain on a win boost) are dropped rather than rejected.
  const allLpGain = catalog.modifiers.filter((modifier) => modifier.category === "LP_GAIN");
  const allAddOns = catalog.modifiers.filter((modifier) => modifier.category === "ADD_ON");
  if (input.lpGain !== null && !allLpGain.some((modifier) => modifier.key === input.lpGain)) {
    return fail("unknown_option");
  }
  if (input.addOns.some((key) => !allAddOns.some((modifier) => modifier.key === key))) {
    return fail("unknown_option");
  }

  const lpOptions = applicableModifiers(catalog, input.orderType, "LP_GAIN");
  const lpGain =
    lpOptions.length === 0
      ? null
      : (lpOptions.find((modifier) => modifier.key === input.lpGain) ??
        lpOptions.find((modifier) => modifier.isDefault) ??
        lpOptions[0]);
  const addOnOptions = applicableModifiers(catalog, input.orderType, "ADD_ON");
  const addOns = addOnOptions.filter((modifier) => input.addOns.includes(modifier.key));

  const service = servicePrice(catalog, input);
  if (typeof service === "string") return fail(service);

  const baseCents = service + catalog.basePriceCents;
  const percentOf = (percentBp: number) => Math.round((baseCents * percentBp) / 10000);

  const modifiers: QuoteModifierLine[] = [
    { key: server.code, category: "SERVER", percentBp: server.percentBp, amountCents: percentOf(server.percentBp) },
    ...(lpGain ? [lpGain] : []).map((modifier) => ({
      key: modifier.key,
      category: modifier.category,
      percentBp: modifier.percentBp,
      amountCents: percentOf(modifier.percentBp),
    })),
    ...addOns.map((modifier) => ({
      key: modifier.key,
      category: modifier.category,
      percentBp: modifier.percentBp,
      amountCents: percentOf(modifier.percentBp),
    })),
  ];

  const subtotalCents = Math.max(0, baseCents + modifiers.reduce((sum, line) => sum + line.amountCents, 0));

  return {
    ok: true,
    quote: {
      serviceCents: service,
      flatFeeCents: catalog.basePriceCents,
      baseCents,
      modifiers,
      subtotalCents,
      applied: { lpGain: lpGain?.key ?? null, addOns: addOns.map((modifier) => modifier.key) },
    },
  };
}

// ---------------------------------------------------------------------------
// Promo codes and currency
// ---------------------------------------------------------------------------

export type PromoTerms = {
  code: string;
  discountType: DiscountType;
  /** Basis points for PERCENTAGE, USD cents for FIXED. */
  value: number;
  minSubtotalCents: number | null;
};

export type PromoResult =
  | { ok: true; discountCents: number; totalCents: number }
  | { ok: false; error: "promo_min_amount"; minSubtotalCents: number };

export function applyPromo(subtotalCents: number, promo: PromoTerms | null): PromoResult {
  if (!promo) return { ok: true, discountCents: 0, totalCents: subtotalCents };
  if (promo.minSubtotalCents !== null && subtotalCents < promo.minSubtotalCents) {
    return { ok: false, error: "promo_min_amount", minSubtotalCents: promo.minSubtotalCents };
  }
  const discount =
    promo.discountType === "PERCENTAGE"
      ? Math.round((subtotalCents * promo.value) / 10000)
      : Math.min(promo.value, subtotalCents);
  return { ok: true, discountCents: discount, totalCents: subtotalCents - discount };
}

/** USD cents -> cents of a currency worth `usdPerUnit` USD per unit. */
export function convertCents(usdCents: number, usdPerUnit: number): number {
  return Math.round(usdCents / usdPerUnit);
}
