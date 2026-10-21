"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendVerificationEmailAction } from "@/features/auth/account-actions";

export function ResendVerificationButton() {
  const t = useTranslations("Auth.verify");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending || sent}
      onClick={() =>
        startTransition(async () => {
          const result = await sendVerificationEmailAction(locale);
          if (!result.success) return void toast.error(result.message);
          setSent(true);
          toast.success(t("sent"));
        })
      }
    >
      {sent ? t("sentShort") : t("resend")}
    </Button>
  );
}
