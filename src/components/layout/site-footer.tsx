import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm text-muted-foreground md:flex-row md:justify-between">
        <p>{t("rights")}</p>
        <p>{t("disclaimer")}</p>
      </div>
    </footer>
  );
}
