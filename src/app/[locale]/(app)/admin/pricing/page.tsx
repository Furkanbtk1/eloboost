import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PanelHeader, PanelSkeleton } from "@/components/layout/panel";
import { PlatformSettingsForm, PricingEditor } from "@/features/admin/components/pricing-editor";
import { getAdminPricing, getPlatformSettings, listPricingGames } from "@/features/admin/pricing";
import { Link } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/admin/pricing">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.nav");
  return { title: t("pricing"), robots: { index: false } };
}

export default function AdminPricingPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <AdminPricing searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminPricing({ searchParams }: Pick<Props, "searchParams">) {
  await requireArea("/admin/pricing");
  const [{ game: rawGame }, games, settings, t] = await Promise.all([
    searchParams,
    listPricingGames(),
    getPlatformSettings(),
    getTranslations("Admin.pricing"),
  ]);
  const slug = typeof rawGame === "string" ? rawGame : games[0]?.slug;
  const pricing = slug ? await getAdminPricing(slug) : null;
  if (!pricing) notFound();

  return (
    <>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        <PlatformSettingsForm boosterSharePercent={settings.boosterSharePercent} minPayoutUsd={settings.minPayoutUsd} />

        <nav aria-label={t("games")} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-1">
            {games.map((game) => (
              <li key={game.slug}>
                <Link
                  href={{ pathname: "/admin/pricing", query: { game: game.slug } }}
                  aria-current={game.slug === pricing.slug ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                    game.slug === pricing.slug ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                    game.status === "INACTIVE" && "line-through",
                  )}
                >
                  {game.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <PricingEditor key={pricing.slug} pricing={pricing} />
      </div>
    </>
  );
}
