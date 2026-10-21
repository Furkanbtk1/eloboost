"use client";

import {
  ArrowRightIcon,
  GraduationCapIcon,
  MailCheckIcon,
  MailXIcon,
  ShieldCheckIcon,
  SwordsIcon,
  TargetIcon,
  TrophyIcon,
  UserRoundIcon,
  VenetianMaskIcon,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buyAccountAction } from "@/features/accounts/actions";
import type { ShopCatalog } from "@/features/accounts/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BoostType = "DIVISION" | "WIN" | "PLACEMENT" | "COACHING";
type Tab = BoostType | "ACCOUNT" | "SMURF";

type GameOption = { slug: string; name: string; logoUrl: string | null; supportedOrderTypes: BoostType[]; startingPrice: number | null };

const TABS: { key: Tab; icon: LucideIcon; label: "proDivisions" | "proGames" | "placements" | "accounts" | "smurfs" | "coaching" }[] = [
  { key: "DIVISION", icon: TrophyIcon, label: "proDivisions" },
  { key: "WIN", icon: SwordsIcon, label: "proGames" },
  { key: "PLACEMENT", icon: TargetIcon, label: "placements" },
  { key: "ACCOUNT", icon: UserRoundIcon, label: "accounts" },
  { key: "SMURF", icon: VenetianMaskIcon, label: "smurfs" },
  { key: "COACHING", icon: GraduationCapIcon, label: "coaching" },
];

/** In-game services: filter tabs, then either boost games to configure or account shelves to buy from. */
export function ServiceBrowser({ games, shop }: { games: GameOption[]; shop: ShopCatalog }) {
  const t = useTranslations("Shop");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("DIVISION");
  const [gameChoice, setGameChoice] = useState<string | null>(null);
  const [serverChoice, setServerChoice] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isShop = tab === "ACCOUNT" || tab === "SMURF";
  const usd = (value: number) => format.number(value, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  const shopGames = useMemo(
    () => shop.games.filter((game) => shop.products.some((product) => product.gameSlug === game.slug && product.kind === tab)),
    [shop, tab],
  );
  const activeGame = shopGames.find((game) => game.slug === gameChoice) ?? shopGames[0] ?? null;
  const servers = useMemo(
    () => shop.servers.filter((server) => server.gameSlug === activeGame?.slug && server.kind === tab),
    [shop, activeGame, tab],
  );
  const activeServer = servers.find((server) => server.code === serverChoice) ?? servers.find((server) => server.stock > 0) ?? servers[0] ?? null;
  const products = shop.products.filter(
    (product) => product.gameSlug === activeGame?.slug && product.kind === tab && product.serverCode === activeServer?.code,
  );

  const buy = (productId: string) => {
    setBuying(productId);
    startTransition(async () => {
      const result = await buyAccountAction(locale, productId);
      if (!result.success) {
        setBuying(null);
        if (result.code === 401) return void router.push("/login?callbackUrl=%2F%23services");
        return void toast.error(result.message);
      }
      router.push(result.data.redirectTo);
    });
  };

  const boostGames = games.filter((game) => !isShop && game.supportedOrderTypes.includes(tab as BoostType));

  return (
    <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
      <div className="mb-6 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="-mx-4 flex gap-1 overflow-x-auto rounded-none border-y border-border/60 bg-card/70 p-1.5 px-4 [scrollbar-width:none] sm:mx-0 sm:rounded-xl sm:border [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setGameChoice(null);
              setServerChoice(null);
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              tab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(`tabs.${label}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-8">
        {!isShop && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boostGames.map((game) => (
              <li key={game.slug}>
                <Link
                  href={`/boost/${game.slug}#service=${tab}`}
                  className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-primary/50"
                >
                  {game.logoUrl && <Image src={game.logoUrl} alt="" width={48} height={48} className="rounded-lg" />}
                  <span className="grid flex-1 gap-0.5">
                    <span className="font-semibold">{game.name}</span>
                    {game.startingPrice !== null && (
                      <span className="text-sm text-muted-foreground">{t("from", { price: usd(game.startingPrice) })}</span>
                    )}
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
            {boostGames.length === 0 && <li className="text-muted-foreground">{t("noGames")}</li>}
          </ul>
        )}

        {isShop && (
          <div className="grid gap-6">
            {shopGames.length === 0 ? (
              <p className="text-muted-foreground">{t("emptyShop")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("chooseGame")}>
                  {shopGames.map((game) => (
                    <button
                      key={game.slug}
                      type="button"
                      aria-pressed={activeGame?.slug === game.slug}
                      onClick={() => {
                        setGameChoice(game.slug);
                        setServerChoice(null);
                      }}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm transition-colors",
                        activeGame?.slug === game.slug ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {game.name}
                    </button>
                  ))}
                </div>

                <div
                  role="radiogroup"
                  aria-label={t("chooseServer")}
                  className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
                >
                  {servers.map((server) => (
                    <button
                      key={server.code}
                      type="button"
                      role="radio"
                      aria-checked={activeServer?.code === server.code}
                      onClick={() => setServerChoice(server.code)}
                      className={cn(
                        "grid min-w-44 shrink-0 gap-1 rounded-xl border p-4 text-left transition-colors",
                        activeServer?.code === server.code ? "border-primary bg-primary/10" : "border-border/60 bg-card/50 hover:border-primary/50",
                        server.stock === 0 && "opacity-60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{server.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{server.code}</span>
                      </span>
                      <span className={cn("text-xs", server.stock > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                        {server.stock > 0 ? t("inStock", { count: server.stock }) : t("outOfStock")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {server.fromPrice !== null ? t("from", { price: usd(server.fromPrice) }) : "—"}
                      </span>
                    </button>
                  ))}
                </div>

                {products.length === 0 ? (
                  <p className="text-muted-foreground">{t("noProducts")}</p>
                ) : (
                  <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => (
                      <li key={product.id} className="grid content-between gap-5 rounded-xl border border-border/60 bg-card/60 p-5">
                        <div className="grid gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold">{product.tier}</h3>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs", product.stock > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground")}>
                              {product.stock > 0 ? t("inStock", { count: product.stock }) : t("soldOut")}
                            </span>
                          </div>
                          <ul className="grid gap-2 text-sm text-muted-foreground">
                            {product.level !== null && (
                              <li className="flex items-center gap-2">
                                <ShieldCheckIcon className="size-4 text-primary" />
                                {t("level", { level: product.level })}
                              </li>
                            )}
                            <li className="flex items-center gap-2">
                              <SwordsIcon className="size-4 text-primary" />
                              {t("champions", { count: product.championCount })}
                            </li>
                            <li className="flex items-center gap-2">
                              {product.hasMailAccess ? <MailCheckIcon className="size-4 text-emerald-400" /> : <MailXIcon className="size-4" />}
                              {product.hasMailAccess ? t("mailYes") : t("mailNo")}
                            </li>
                          </ul>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-2xl font-bold tracking-tight">{usd(product.price)}</span>
                          <Button disabled={product.stock === 0 || isPending} onClick={() => buy(product.id)}>
                            {buying === product.id && isPending ? t("buying") : t("buy")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">{t("deliveryNote")}</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
