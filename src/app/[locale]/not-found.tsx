import { useTranslations } from "next-intl";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <Button asChild>
          <Link href="/">{t("back")}</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
