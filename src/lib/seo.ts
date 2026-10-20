import "server-only";

import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { env } from "@/lib/env";

/** Public origin used for canonical URLs, hreflang, the sitemap and OpenGraph. */
export const siteUrl = new URL(env.NEXT_PUBLIC_APP_URL);

export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();

export const localizedUrl = (href: string, locale: AppLocale) => absoluteUrl(getPathname({ href, locale }));

/** hreflang for every language plus x-default (English, unprefixed). */
export function languageAlternates(href: string): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((locale) => [locale, localizedUrl(href, locale)])),
    "x-default": localizedUrl(href, routing.defaultLocale),
  };
}

const OG_LOCALES: Record<AppLocale, string> = { en: "en_US", tr: "tr_TR", de: "de_DE", es: "es_ES" };

/** Canonical, hreflang and OpenGraph/Twitter tags of a public, indexable page. */
export function publicPageMetadata(input: {
  href: string;
  locale: AppLocale;
  title: string;
  description: string;
  siteName: string;
}): Metadata {
  const url = localizedUrl(input.href, input.locale);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url, languages: languageAlternates(input.href) },
    openGraph: {
      type: "website",
      url,
      title: input.title,
      description: input.description,
      siteName: input.siteName,
      locale: OG_LOCALES[input.locale],
      alternateLocale: routing.locales.filter((locale) => locale !== input.locale).map((locale) => OG_LOCALES[locale]),
    },
    twitter: { card: "summary_large_image", title: input.title, description: input.description },
  };
}

/** JSON-LD for a <script type="application/ld+json">; "<" is escaped so content can't close the tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
}
