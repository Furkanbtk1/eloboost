"use client";

import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Same button without the menu, shown while the current URL is not known yet. */
export function LocaleSwitcherFallback() {
  const t = useTranslations("Header");
  const locale = useLocale();
  return (
    <Button variant="ghost" size="sm" disabled aria-label={t("language")}>
      <LanguagesIcon />
      <span className="uppercase">{locale}</span>
    </Button>
  );
}

/** Needs the current pathname, so render it inside <Suspense> (see SiteHeader). */
export function LocaleSwitcher() {
  const t = useTranslations("Header");
  const tLocale = useTranslations("Locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} aria-label={t("language")}>
          <LanguagesIcon />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {routing.locales.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => startTransition(() => router.replace(pathname, { locale: option }))}
          >
            {tLocale(option)}
            {option === locale && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
