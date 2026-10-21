import type { MetadataRoute } from "next";
import { hasLocale } from "next-intl";

import { listPublishedSlugs } from "@/features/blog/queries";
import { getActiveGameSlugs } from "@/features/pricing/catalog";
import { routing } from "@/i18n/routing";
import { languageAlternates, localizedUrl } from "@/lib/seo";

/** Public pages only (home and one calculator per active game), in every language. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, posts] = await Promise.all([getActiveGameSlugs(), listPublishedSlugs()]);
  const pages = [
    { href: "/", changeFrequency: "daily" as const, priority: 1 },
    { href: "/blog", changeFrequency: "daily" as const, priority: 0.7 },
    ...slugs.map((slug) => ({ href: `/boost/${slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
  // A post exists in one language only, so it has a single URL and no hreflang alternates.
  const postEntries = posts.map((post) => ({
    url: localizedUrl(`/blog/${post.slug}`, hasLocale(routing.locales, post.locale) ? post.locale : routing.defaultLocale),
    lastModified: post.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [
    ...pages.map(({ href, changeFrequency, priority }) => ({
      url: localizedUrl(href, routing.defaultLocale),
      changeFrequency,
      priority,
      alternates: { languages: languageAlternates(href) },
    })),
    ...postEntries,
  ];
}
