import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  // `locale` is only set when passed explicitly, e.g. getTranslations({ locale }).
  // Root params are unavailable in Server Actions and Route Handlers, so those
  // must always pass the locale explicitly.
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
