import { getTranslations } from "next-intl/server";

import { PaymentBadges } from "@/components/layout/payment-badges";
import { getActiveGames } from "@/features/games/queries";
import { Link } from "@/i18n/navigation";

/** Games that always appear in the footer; shown as "soon" until their calculator exists. */
const FEATURED_GAMES = [
  { slug: "wild-rift", name: "Wild Rift" },
  { slug: "marvel-rivals", name: "Marvel Rivals" },
] as const;

const linkClass = "text-muted-foreground transition-colors hover:text-foreground";

export async function SiteFooter() {
  const [t, games] = await Promise.all([getTranslations("Footer"), getActiveGames()]);

  const gameLinks = [
    ...games.map((game) => ({ slug: game.slug, name: game.name, available: true })),
    ...FEATURED_GAMES.filter((featured) => !games.some((game) => game.slug === featured.slug)).map((featured) => ({
      ...featured,
      available: false,
    })),
  ];

  const columns = [
    {
      title: t("columns.tools"),
      links: [
        { href: { pathname: "/", hash: "games" } as const, label: t("links.calculator") },
        { href: "/dashboard" as const, label: t("links.tracking") },
      ],
    },
    {
      title: t("columns.guides"),
      links: [
        { href: "/blog" as const, label: t("links.blog") },
        { href: { pathname: "/", hash: "how-it-works" } as const, label: t("links.howItWorks") },
      ],
    },
    {
      title: t("columns.company"),
      links: [
        { href: "/company/about" as const, label: t("links.about") },
        { href: "/company/contact" as const, label: t("links.contact") },
      ],
    },
    {
      title: t("columns.legal"),
      links: [
        { href: "/legal/terms" as const, label: t("links.terms") },
        { href: "/legal/privacy" as const, label: t("links.privacy") },
        { href: "/legal/refunds" as const, label: t("links.refunds") },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid justify-items-center gap-3 border-b border-border/60 py-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("payments")}</p>
          <PaymentBadges />
        </div>

        <nav aria-label={t("navLabel")} className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid content-start gap-4">
            <h2 className="text-sm font-semibold">{t("columns.games")}</h2>
            <ul className="grid gap-2.5 text-sm">
              {gameLinks.map((game) => (
                <li key={game.slug}>
                  {game.available ? (
                    <Link href={`/boost/${game.slug}`} className={linkClass}>
                      {game.name}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground/70">
                      {game.name}
                      <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[0.65rem] leading-none">{t("soon")}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <div key={column.title} className="grid content-start gap-4">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <ul className="grid gap-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-border/60 py-6 text-xs text-muted-foreground md:flex-row md:justify-between">
          <p>{t("rights")}</p>
          <p className="max-w-xl md:text-right">{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
