import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PostBody } from "@/features/blog/components/post-body";
import { readingMinutes } from "@/features/blog/markdown";
import { getPublishedPost, listPublishedSlugs } from "@/features/blog/queries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl, jsonLd, localizedUrl, publicPageMetadata } from "@/lib/seo";

type Props = PageProps<"/[locale]/blog/[slug]">;

// The slug is read outside <Suspense> on purpose (real 404 status for unknown
// posts); published posts are cached, so blocking on them is cheap.
export const instant = false;

export async function generateStaticParams() {
  const posts = await listPublishedSlugs();
  // At least one entry is required; an unknown slug renders the 404 page.
  return posts.length > 0 ? posts.map((post) => ({ slug: post.slug })) : [{ slug: "-" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const [post, tMeta] = await Promise.all([getPublishedPost(slug), getTranslations({ locale, namespace: "Metadata" })]);
  if (!post) return {};
  const metadata = publicPageMetadata({
    href: `/blog/${post.slug}`,
    locale,
    title: post.title,
    description: post.excerpt,
    siteName: tMeta("siteName"),
  });
  const postLocale = hasLocale(routing.locales, post.locale) ? post.locale : routing.defaultLocale;
  return {
    ...metadata,
    // One language per post: canonical points at it and there are no hreflang alternates.
    alternates: { canonical: localizedUrl(`/blog/${post.slug}`, postLocale) },
    openGraph: { ...metadata.openGraph, type: "article", publishedTime: post.publishedAt.toISOString() },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug, locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const [post, t, format] = await Promise.all([getPublishedPost(slug), getTranslations("Blog"), getFormatter()]);
  if (!post) notFound();

  const structuredData = jsonLd({
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    inLanguage: post.locale,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.author },
    publisher: { "@id": absoluteUrl("/#organization") },
    mainEntityOfPage: localizedUrl(`/blog/${post.slug}`, locale),
  });

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14">
        <Link href="/blog" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </Link>
        <article className="grid gap-8">
          <header className="grid gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-balance">{post.title}</h1>
            <p className="text-sm text-muted-foreground">
              <time dateTime={post.publishedAt.toISOString()}>{format.dateTime(post.publishedAt, { dateStyle: "long", timeZone: "UTC" })}</time>
              {" · "}
              {post.author}
              {" · "}
              {t("minutes", { count: readingMinutes(post.content) })}
            </p>
          </header>
          <PostBody content={post.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
