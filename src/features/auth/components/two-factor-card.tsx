"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CopyIcon, DownloadIcon } from "lucide-react";
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
  regenerateBackupCodesAction,
  startTwoFactorSetupAction,
  type TwoFactorSetup,
} from "@/features/auth/two-factor-actions";

type Props = {
  enabled: boolean;
  /** 2FA is tied to password sign-in; OAuth-only accounts can't enable it. */
  hasPassword: boolean;
  /** Role requires 2FA, so it can't be turned off. */
  mandatory: boolean;
  /** Recovery codes left (shown while 2FA is on). */
  unusedCodes: number;
};

export function TwoFactorCard({ enabled, hasPassword, mandatory, unusedCodes }: Props) {
  const t = useTranslations("Security");
  const tFields = useTranslations("Auth.fields");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const router = useRouter();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  /** Fresh recovery codes, shown once; `redirectTo` is set while finishing the initial setup. */
  const [codes, setCodes] = useState<{ list: string[]; redirectTo: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => twoFactorCodeSchema(tValidation), [tValidation]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: "" } });
  const regenForm = useForm({ resolver: zodResolver(schema), defaultValues: { code: "" } });

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
      // The codes come first; moving on happens from the codes screen (full navigation, the session cookie changed).
      setCodes({ list: result.data.backupCodes, redirectTo: result.data.redirectTo });
    }),
  );

  const regenerate = regenForm.handleSubmit((values) =>
    startTransition(async () => {
      const result = await regenerateBackupCodesAction(locale, values);
      if (!result.success) {
        applyFieldErrors(regenForm.setError, result.fieldErrors);
        return void toast.error(result.message);
      }
      regenForm.reset();
      setCodes({ list: result.data.backupCodes, redirectTo: null });
      router.refresh();
    }),
  );

  const copyCodes = async (list: string[]) => {
    try {
      await navigator.clipboard.writeText(list.join("\n"));
      toast.success(t("codesCopied"));
    } catch {
      toast.error(t("codesCopyFailed"));
    }
  };

  const downloadCodes = (list: string[]) => {
    const url = URL.createObjectURL(new Blob([list.join("\n") + "\n"], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "eloboost-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

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

  if (codes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("codesTitle")}</CardTitle>
          <CardDescription>{t("codesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
            {codes.list.map((code) => (
              <li key={code} className="select-all">
                {code}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyCodes(codes.list)}>
              <CopyIcon />
              {t("codesCopy")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCodes(codes.list)}>
              <DownloadIcon />
              {t("codesDownload")}
            </Button>
          </div>
          <Button
            className="justify-self-start"
            onClick={() => {
              if (codes.redirectTo) window.location.assign(codes.redirectTo);
              else setCodes(null);
            }}
          >
            {t("codesSaved")}
          </Button>
        </CardContent>
      </Card>
    );
  }

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

        {enabled && (
          <div className="grid gap-3 rounded-lg border p-4">
            <div className="grid gap-1">
              <span className="text-sm font-medium">{t("backupTitle")}</span>
              <span className="text-sm text-muted-foreground">{t("backupLeft", { count: unusedCodes })}</span>
            </div>
            <form onSubmit={regenerate} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
              <FormField
                id="regen-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                label={tFields("code")}
                error={regenForm.formState.errors.code?.message}
                {...regenForm.register("code")}
              />
              <Button type="submit" variant="outline" disabled={isPending}>
                {t("backupRegenerate")}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{t("backupRegenerateHint")}</p>
          </div>
        )}

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
