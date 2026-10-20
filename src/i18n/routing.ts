import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "tr", "de", "es"],
  defaultLocale: "en",
  // English lives at "/", other languages at "/tr", "/de", "/es".
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
