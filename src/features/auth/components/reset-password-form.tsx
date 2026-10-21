"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordAction } from "@/features/auth/account-actions";
import { applyFieldErrors } from "@/features/auth/components/apply-field-errors";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const schema = useMemo(() => resetPasswordSchema(tValidation), [tValidation]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await resetPasswordAction(locale, token, values);
      if (!result.success) {
        applyFieldErrors(form.setError, result.fieldErrors);
        return void toast.error(result.message);
      }
      toast.success(t("reset.done"));
      // Full navigation: sign-in starts from a clean state.
      window.location.assign(result.data.redirectTo);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("reset.title")}</CardTitle>
        <CardDescription>{t("reset.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
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
            {t("reset.submit")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="font-medium underline-offset-4 hover:underline">
          {t("forgot.back")}
        </Link>
      </CardFooter>
    </Card>
  );
}
