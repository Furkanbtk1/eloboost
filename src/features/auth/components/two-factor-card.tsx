"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyFieldErrors } from "@/features/auth/components/apply-field-errors";
import { twoFactorCodeSchema } from "@/features/auth/schemas";
import {
  disableTwoFactorAction,
  enableTwoFactorAction,
  startTwoFactorSetupAction,
  type TwoFactorSetup,
} from "@/features/auth/two-factor-actions";

type Props = {
  enabled: boolean;
  /** 2FA is tied to password sign-in; OAuth-only accounts can't enable it. */
  hasPassword: boolean;
  /** Role requires 2FA, so it can't be turned off. */
  mandatory: boolean;
};

export function TwoFactorCard({ enabled, hasPassword, mandatory }: Props) {
  const t = useTranslations("Security");
  const tFields = useTranslations("Auth.fields");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => twoFactorCodeSchema(tValidation), [tValidation]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: "" } });

  const startSetup = () =>
    startTransition(async () => {
      const result = await startTwoFactorSetupAction(locale);
      if (!result.success) return void toast.error(result.message);
      setSetup(result.data);
    });

  const submitCode = form.handleSubmit((values) =>
    startTransition(async () => {
      if (enabled) {
        const result = await disableTwoFactorAction(locale, values);
        if (!result.success) {
          applyFieldErrors(form.setError, result.fieldErrors);
          return void toast.error(result.message);
        }
        toast.success(t("disabledToast"));
        form.reset();
        router.refresh();
        return;
      }

      const result = await enableTwoFactorAction(locale, values);
      if (!result.success) {
        applyFieldErrors(form.setError, result.fieldErrors);
        return void toast.error(result.message);
      }
      toast.success(t("enabledToast"));
      // Full navigation: the session cookie changed and the proxy must see it.
      window.location.assign(result.data.redirectTo);
    }),
  );

  const codeForm = (submitLabel: string) => (
    <form onSubmit={submitCode} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
      <FormField
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        label={tFields("code")}
        error={form.formState.errors.code?.message}
        {...form.register("code")}
      />
      <Button type="submit" disabled={isPending} variant={enabled ? "destructive" : "default"}>
        {submitLabel}
      </Button>
    </form>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("twoFactorTitle")}</CardTitle>
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? t("statusEnabled") : t("statusDisabled")}</Badge>
        </div>
        <CardDescription>{t("twoFactorDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {enabled && mandatory && <p className="text-sm text-muted-foreground">{t("mandatoryHint")}</p>}

        {enabled && !mandatory && (
          <>
            <p className="text-sm text-muted-foreground">{t("disableHint")}</p>
            {codeForm(t("disable"))}
          </>
        )}

        {!enabled && !hasPassword && <p className="text-sm text-muted-foreground">{t("passwordOnly")}</p>}

        {!enabled && hasPassword && !setup && (
          <Button onClick={startSetup} disabled={isPending} className="justify-self-start">
            {t("start")}
          </Button>
        )}

        {!enabled && setup && (
          <>
            <p className="text-sm text-muted-foreground">{t("scanHint")}</p>
            <Image
              src={setup.qrCodeDataUrl}
              alt=""
              width={220}
              height={220}
              unoptimized
              className="rounded-lg bg-white p-2"
            />
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("manualHint")}</span>
              <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all select-all">{setup.secret}</code>
            </div>
            {codeForm(t("enable"))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
