"use client";

import { RotateCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary for unexpected server or render errors (e.g. the
 * database is down). Expected failures are returned as { success: false }
 * results and shown as toasts instead.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">{t("reference", { digest: error.digest })}</p>}
      <Button onClick={reset}>
        <RotateCwIcon />
        {t("retry")}
      </Button>
    </main>
  );
}
