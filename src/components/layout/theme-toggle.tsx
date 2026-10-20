"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export function ThemeToggle() {
  const t = useTranslations("Header");
  const toggleTheme = useUIStore((state) => state.toggleTheme);

  // Both icons render and CSS picks one, so the markup never depends on
  // client-only state and hydration stays stable.
  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t("toggleTheme")}>
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
    </Button>
  );
}
