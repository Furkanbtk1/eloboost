"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordResetAction } from "@/features/auth/account-actions";
import { applyFieldErrors } from "@/features/auth/components/apply-field-errors";
import { emailOnlySchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const schema = useMemo(() => emailOnlySchema(tValidation), [tValidation]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await requestPasswordResetAction(locale, values);
      if (!result.success) {
        applyFieldErrors(form.setError, result.fieldErrors);
        return void toast.error(result.message);
      }
      setSent(true);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("forgot.title")}</CardTitle>
        <CardDescription>{sent ? t("forgot.sentTitle") : t("forgot.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="flex gap-3 text-sm text-muted-foreground">
            <MailCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            {t("forgot.sentBody", { email: form.getValues("email") })}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormField
              id="email"
              type="email"
              autoComplete="email"
              label={t("fields.email")}
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {t("forgot.submit")}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/login" className="font-medium underline-offset-4 hover:underline">
          {t("forgot.back")}
        </Link>
      </CardFooter>
    </Card>
  );
}
