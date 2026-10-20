import { ActivityIcon, ArrowDownIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicReviews } from "@/features/feedback/components/public-reviews";
import { GameCard } from "@/features/games/game-card";
import { getActiveGames } from "@/features/games/queries";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo";

const FEATURES = [
  { key: "verified", icon: ShieldCheckIcon },
  { key: "secure", icon: LockKeyholeIcon },
  { key: "tracking", icon: ActivityIcon },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    ...publicPageMetadata({ href: "/", locale, title: t("title"), description: t("description"), siteName: t("siteName") }),
    // The layout's title template would add the site name twice.
    title: { absolute: t("title") },
  };
}

export default async function HomePage() {
  const [t, tMeta, games] = await Promise.all([getTranslations("Home"), getTranslations("Metadata"), getActiveGames()]);
  const structuredData = jsonLd({
    "@graph": [
      { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: tMeta("siteName"), url: absoluteUrl("/") },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: tMeta("siteName"),
        url: absoluteUrl("/"),
        description: tMeta("description"),
        publisher: { "@id": absoluteUrl("/#organization") },
      },
    ],
  });

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-112 max-w-3xl rounded-full bg-linear-to-r from-primary/30 to-highlight/20 blur-3xl"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
            <Badge variant="outline" className="px-3 py-1 text-xs">
              {t("badge")}
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
            <Button asChild size="lg">
              <Link href={{ pathname: "/", hash: "games" }}>
                {t("cta")}
                <ArrowDownIcon />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-border/60 bg-card/50 p-6">
              <Icon className="mb-3 size-6 text-primary" />
              <h2 className="font-semibold">{t(`features.${key}.title`)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
            </div>
          ))}
        </section>

        <section id="games" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
          <div className="mb-8 space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">{t("gamesTitle")}</h2>
            <p className="text-muted-foreground">{t("gamesSubtitle")}</p>
          </div>

          {games.length === 0 ? (
            <p className="text-muted-foreground">{t("noGames")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>

        <PublicReviews />
      </main>

      <SiteFooter />
    </>
  );
}
