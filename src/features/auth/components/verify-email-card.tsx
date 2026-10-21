"use client";

import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyEmailAction } from "@/features/auth/account-actions";
import { Link } from "@/i18n/navigation";

/** The link only opens this page; the click spends it, so mail scanners that prefetch links can't. */
export function VerifyEmailCard({ token }: { token: string | null }) {
  const t = useTranslations("Auth.verify");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"ready" | "done" | "failed">(token ? "ready" : "failed");
  const [message, setMessage] = useState<string>();

  const confirm = () =>
    startTransition(async () => {
      const result = await verifyEmailAction(locale, token ?? "");
      setState(result.success ? "done" : "failed");
      if (!result.success) setMessage(result.message);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{state === "ready" ? t("subtitle") : null}</CardDescription>
      </CardHeader>
      <CardContent>
        {state === "ready" && (
          <Button onClick={confirm} disabled={isPending} className="w-full">
            {t("confirm")}
          </Button>
        )}
        {state === "done" && (
          <p className="flex gap-3 text-sm">
            <CircleCheckIcon className="size-5 shrink-0 text-emerald-500" />
            {t("done")}
          </p>
        )}
        {state === "failed" && (
          <p className="flex gap-3 text-sm text-muted-foreground">
            <CircleXIcon className="size-5 shrink-0 text-destructive" />
            {message ?? t("invalid")}
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/dashboard" className="font-medium underline-offset-4 hover:underline">
          {t("continue")}
        </Link>
      </CardFooter>
    </Card>
  );
}
