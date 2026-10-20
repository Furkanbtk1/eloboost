import { ZapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { LocaleSwitcher, LocaleSwitcherFallback } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useTranslations("Header");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-primary to-highlight text-primary-foreground">
            <ZapIcon className="size-4" />
          </span>
          EloBoost
        </Link>

        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link
            href={{ pathname: "/", hash: "games" }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("games")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Dynamic routes only know their URL at request time. */}
          <Suspense fallback={<LocaleSwitcherFallback />}>
            <LocaleSwitcher />
          </Suspense>
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="ml-1 h-7 w-28" />}>
            <UserNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
