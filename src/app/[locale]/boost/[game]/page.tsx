import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Calculator } from "@/features/calculator/components/calculator";
import { getActiveGames } from "@/features/games/queries";
import { getActiveGameSlugs, getPricingCatalog } from "@/features/pricing/catalog";
import { getExchangeRates } from "@/features/pricing/exchange-rates";

type Props = PageProps<"/[locale]/boost/[game]">;

// The slug is awaited outside <Suspense> on purpose (real 404 status for unknown
// games); known games are fully prerendered, so blocking on them is cheap.
export const instant = false;

export async function generateStaticParams() {
  return (await getActiveGameSlugs()).map((game) => ({ game }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game } = await params;
  const [catalog, t] = await Promise.all([getPricingCatalog(game), getTranslations("BoostPage")]);
  if (!catalog) return {};
  return {
    title: t("title", { game: catalog.name }),
    description: t("metaDescription", { game: catalog.name }),
  };
}

/** Rates baked into the page; checkout re-reads them on the server. */
async function getDisplayRates() {
  "use cache";
  cacheLife("hours");
  return getExchangeRates();
}

// Every input here is cached, so known games prerender completely. The game is
// resolved before anything streams so an unknown slug gets a real 404 status.
export default async function BoostPage({ params }: Props) {
  const { game } = await params;
  const [catalog, rates, games, t] = await Promise.all([
    getPricingCatalog(game),
    getDisplayRates(),
    getActiveGames(),
    getTranslations("BoostPage"),
  ]);
  if (!catalog) notFound();
  const logoUrl = games.find((entry) => entry.slug === catalog.slug)?.logoUrl;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-8 flex items-center gap-4">
          {logoUrl && <Image src={logoUrl} alt="" width={56} height={56} className="rounded-xl" priority />}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{t("title", { game: catalog.name })}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <Calculator catalog={catalog} rates={rates} />
      </main>
      <SiteFooter />
    </>
  );
}
