import type { MetadataRoute } from "next";

import { getActiveGameSlugs } from "@/features/pricing/catalog";
import { routing } from "@/i18n/routing";
import { languageAlternates, localizedUrl } from "@/lib/seo";

/** Public pages only (home and one calculator per active game), in every language. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getActiveGameSlugs();
  const pages = [
    { href: "/", changeFrequency: "daily" as const, priority: 1 },
    ...slugs.map((slug) => ({ href: `/boost/${slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
  return pages.map(({ href, changeFrequency, priority }) => ({
    url: localizedUrl(href, routing.defaultLocale),
    changeFrequency,
    priority,
    alternates: { languages: languageAlternates(href) },
  }));
}
