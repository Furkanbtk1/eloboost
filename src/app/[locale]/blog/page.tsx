import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { listPublishedPosts } from "@/features/blog/queries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { publicPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const [t, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "Blog" }),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);
  return publicPageMetadata({ href: "/blog", locale, title: t("title"), description: t("description"), siteName: tMeta("siteName") });
}

export default async function BlogPage({ params }: PageProps<"/[locale]/blog">) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const [posts, t, format] = await Promise.all([listPublishedPosts(locale), getTranslations("Blog"), getFormatter()]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-14">
        <header className="mb-10 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-lg text-muted-foreground">{t("description")}</p>
        </header>

        {posts.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="grid gap-5">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group grid gap-2 rounded-xl border border-border/60 bg-card/50 p-6 transition-colors hover:border-primary/50"
                >
                  <time dateTime={post.publishedAt.toISOString()} className="text-xs text-muted-foreground">
                    {format.dateTime(post.publishedAt, { dateStyle: "long", timeZone: "UTC" })} · {post.author}
                  </time>
                  <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
                  <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    {t("read")}
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
