"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { OAuthProviderId } from "@/auth";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { registerAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/features/auth/components/apply-field-errors";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { registerSchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";

export function RegisterForm({ oauthProviders }: { oauthProviders: OAuthProviderId[] }) {
  const t = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => registerSchema(tValidation), [tValidation]);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await registerAction(locale, values);
      if (!result.success) {
        applyFieldErrors(form.setError, result.fieldErrors);
        toast.error(result.message);
        return;
      }
      window.location.assign(result.data.redirectTo);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("register.title")}</CardTitle>
        <CardDescription>{t("register.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField id="name" autoComplete="name" label={t("fields.name")} error={errors.name?.message} {...form.register("name")} />
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
            autoComplete="new-password"
            label={t("fields.password")}
            error={errors.password?.message}
            {...form.register("password")}
          />
          <FormField
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            label={t("fields.confirmPassword")}
            error={errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />
          <Button type="submit" disabled={isPending} className="w-full">
            {t("register.submit")}
          </Button>
        </form>

        <OAuthButtons providers={oauthProviders} callbackUrl={null} />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t("register.haveAccount")}&nbsp;
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("register.loginLink")}
        </Link>
      </CardFooter>
    </Card>
  );
}
