import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { absoluteUrl, siteUrl } from "@/lib/seo";

/** Panels, checkout and sign-in pages are private or worthless to index, in every language prefix. */
const PRIVATE = ["/admin", "/booster", "/dashboard", "/checkout", "/account", "/login", "/register"];

export default function robots(): MetadataRoute.Robots {
  const prefixes = ["", ...routing.locales.filter((locale) => locale !== routing.defaultLocale).map((locale) => `/${locale}`)];
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", ...prefixes.flatMap((prefix) => PRIVATE.map((path) => `${prefix}${path}`))],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl.origin,
  };
}
