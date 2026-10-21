"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { OAuthProviderId } from "@/auth";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/features/auth/components/apply-field-errors";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { loginSchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";

const OAUTH_ERRORS = ["OAuthEmailUnverified", "OAuthAccountNotLinked", "OAuthStaff", "OAuthTwoFactor", "AccountBanned"] as const;
type OAuthErrorKey = (typeof OAUTH_ERRORS)[number];

function oauthErrorKey(value: string | null): OAuthErrorKey | "default" | null {
  if (!value) return null;
  return OAUTH_ERRORS.find((key) => key === value) ?? "default";
}

export function LoginForm({ oauthProviders }: { oauthProviders: OAuthProviderId[] }) {
  const t = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const errorKey = oauthErrorKey(searchParams.get("error"));

  const [step, setStep] = useState<"credentials" | "twoFactor">("credentials");
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => loginSchema(tValidation), [tValidation]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", code: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    if (step === "twoFactor" && !values.code) {
      form.setError("code", { message: tValidation("codeInvalid") });
      return;
    }
    startTransition(async () => {
      const result = await loginAction(locale, values, callbackUrl);
      if (!result.success) {
        applyFieldErrors(form.setError, result.fieldErrors);
        toast.error(result.message);
        return;
      }
      if (result.data.status === "two_factor_required") {
        setStep("twoFactor");
        return;
      }
      // Full navigation so the proxy and server components see the new session cookie.
      window.location.assign(result.data.redirectTo);
    });
  });

  const backToCredentials = () => {
    form.resetField("code");
    setStep("credentials");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{step === "twoFactor" ? t("login.twoFactorTitle") : t("login.title")}</CardTitle>
        <CardDescription>{step === "twoFactor" ? t("login.twoFactorHint") : t("login.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        {errorKey && step === "credentials" && (
          <Alert variant="destructive">
            <AlertDescription>{t(`oauthErrors.${errorKey}`)}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {step === "credentials" ? (
            <>
              <FormField
                id="email"
                type="email"
                autoComplete="email"
                label={t("fields.email")}
                error={errors.email?.message}
                {...form.register("email")}
              />
              <FormField
                id="password"
                type="password"
                autoComplete="current-password"
                label={t("fields.password")}
                error={errors.password?.message}
                {...form.register("password")}
              />
              <Link href="/forgot-password" className="-mt-2 justify-self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {t("login.forgot")}
              </Link>
            </>
          ) : (
            <FormField
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={11}
              autoFocus
              label={t("fields.code")}
              error={errors.code?.message}
              {...form.register("code")}
            />
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {step === "twoFactor" && <ShieldCheckIcon />}
            {step === "twoFactor" ? t("login.verify") : t("login.submit")}
          </Button>

          {step === "twoFactor" && (
            <Button type="button" variant="ghost" onClick={backToCredentials} disabled={isPending}>
              <ArrowLeftIcon />
              {t("login.back")}
            </Button>
          )}
        </form>

        {step === "credentials" && <OAuthButtons providers={oauthProviders} callbackUrl={callbackUrl} />}
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t("login.noAccount")}&nbsp;
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("login.registerLink")}
        </Link>
      </CardFooter>
    </Card>
  );
}
