import {
  applicableModifiers,
  maxPosition,
  maxRating,
  POINTS_BUCKET_KEYS,
  QUANTITY_LIMITS,
  type OrderType,
  type PricingCatalog,
  type QuoteInput,
} from "@/features/pricing/engine";

/**
 * Builds and repairs calculator selections for the UI. The engine stays the
 * judge of validity; these helpers only keep the controls in a usable state.
 */

const RATING_STEP = 100;

const isTiered = (catalog: PricingCatalog) => catalog.rankSystem === "DIVISION";

export function rankBounds(catalog: PricingCatalog) {
  return isTiered(catalog)
    ? { min: 0, max: maxPosition(catalog), step: 1 }
    : { min: 0, max: maxRating(catalog), step: RATING_STEP };
}

function defaultQuantity(orderType: OrderType): number {
  return orderType === "DIVISION" ? QUANTITY_LIMITS.WIN.default : QUANTITY_LIMITS[orderType].default;
}

function defaultLpGain(catalog: PricingCatalog): string | null {
  const options = catalog.modifiers.filter((modifier) => modifier.category === "LP_GAIN");
  return (options.find((modifier) => modifier.isDefault) ?? options[0])?.key ?? null;
}

export function defaultConfig(catalog: PricingCatalog): QuoteInput {
  const { max, step } = rankBounds(catalog);
  // Start around the middle of the ladder: e.g. LoL Gold IV -> Platinum IV, CS2 9,000 -> 12,000.
  const current = isTiered(catalog) ? Math.floor(max * 0.4) : Math.round((max * 0.25) / 1000) * 1000;
  const target = Math.min(max, current + (isTiered(catalog) ? 4 : 30 * step));
  const orderType = catalog.orderTypes[0] ?? "DIVISION";

  return {
    orderType,
    current,
    target,
    currentPoints: "0-20",
    quantity: defaultQuantity(orderType),
    server: catalog.servers[0]?.code ?? "",
    lpGain: defaultLpGain(catalog),
    addOns: [],
  };
}

/** Keeps a saved selection where it is still valid for the catalog, defaults elsewhere. */
export function normalizeConfig(catalog: PricingCatalog, saved: QuoteInput | undefined): QuoteInput {
  const fallback = defaultConfig(catalog);
  if (!saved) return fallback;

  const { min, max } = rankBounds(catalog);
  const inRange = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

  const orderType = catalog.orderTypes.includes(saved.orderType) ? saved.orderType : fallback.orderType;
  let current = inRange(saved.current) ? saved.current : fallback.current;
  let target = inRange(saved.target) ? saved.target : fallback.target;
  if (target <= current) [current, target] = [fallback.current, fallback.target];

  const limits = orderType === "DIVISION" ? null : QUANTITY_LIMITS[orderType];
  const quantity =
    limits && Number.isInteger(saved.quantity) && saved.quantity >= limits.min && saved.quantity <= limits.max
      ? saved.quantity
      : defaultQuantity(orderType);

  const has = (key: string | null, category: "LP_GAIN" | "ADD_ON") =>
    catalog.modifiers.some((modifier) => modifier.category === category && modifier.key === key);

  return {
    orderType,
    current,
    target,
    currentPoints: POINTS_BUCKET_KEYS.includes(saved.currentPoints) ? saved.currentPoints : fallback.currentPoints,
    quantity,
    server: catalog.servers.some((server) => server.code === saved.server) ? saved.server : fallback.server,
    lpGain: has(saved.lpGain, "LP_GAIN") ? saved.lpGain : fallback.lpGain,
    addOns: Array.isArray(saved.addOns) ? [...new Set(saved.addOns.filter((key) => has(key, "ADD_ON")))] : [],
  };
}

export function withOrderType(config: QuoteInput, orderType: OrderType): QuoteInput {
  return { ...config, orderType, quantity: defaultQuantity(orderType) };
}

/** Moving the current rank pushes the desired rank up so the range stays valid. */
export function withCurrent(catalog: PricingCatalog, config: QuoteInput, current: number): QuoteInput {
  const { max, step } = rankBounds(catalog);
  const needsRoom = config.orderType === "DIVISION";
  const clamped = Math.min(current, needsRoom ? max - step : max);
  const target = needsRoom && config.target <= clamped ? Math.min(max, clamped + step) : config.target;
  return { ...config, current: clamped, target };
}

export function withTarget(catalog: PricingCatalog, config: QuoteInput, target: number): QuoteInput {
  const { step } = rankBounds(catalog);
  return { ...config, target: Math.max(target, config.current + step) };
}

/** LP gain options shown for the current order type. */
export function lpGainOptions(catalog: PricingCatalog, orderType: OrderType) {
  return applicableModifiers(catalog, orderType, "LP_GAIN");
}
