import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";

import { getActiveGames } from "@/features/games/queries";
import { routing } from "@/i18n/routing";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "EloBoost";

export default async function Image({ params }: { params: Promise<{ locale: string; game: string }> }) {
  const { locale: raw, game: slug } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const [t, tHome, format, games] = await Promise.all([
    getTranslations({ locale, namespace: "BoostPage" }),
    getTranslations({ locale, namespace: "Home" }),
    getFormatter({ locale }),
    getActiveGames(),
  ]);
  const game = games.find((entry) => entry.slug === slug);
  const name = game?.name ?? "EloBoost";
  const chip =
    game?.startingPrice != null
      ? tHome("startingFrom", { price: format.number(game.startingPrice, { style: "currency", currency: "USD" }) })
      : undefined;
  return renderOgImage({ title: t("title", { game: name }), subtitle: t("metaDescription", { game: name }), chip });
}
