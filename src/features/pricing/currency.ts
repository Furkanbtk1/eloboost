import type { Currency } from "@/generated/prisma/enums";

/** Value of one unit of each currency in USD (USD = 1). */
export type ExchangeRates = Record<Currency, number>;

export const CURRENCIES = ["USD", "EUR", "GBP", "TRY"] as const satisfies readonly Currency[];

/** Default display currency per UI language; the user can change it. */
export const DEFAULT_CURRENCY_BY_LOCALE: Record<string, Currency> = {
  en: "USD",
  tr: "TRY",
  de: "EUR",
  es: "EUR",
};
