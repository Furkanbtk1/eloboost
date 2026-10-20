"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sandboxPaymentAction, type SandboxOutcome } from "@/features/payments/actions";

export function SandboxButtons({ reference }: { reference: string }) {
  const t = useTranslations("Payments.sandbox");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const report = (outcome: SandboxOutcome) =>
    startTransition(async () => {
      const result = await sandboxPaymentAction(locale, reference, outcome);
      if (!result.success) return void toast.error(result.message);
      router.push(result.data.redirectTo);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={isPending} onClick={() => report("paid")}>
        {t("succeed")}
      </Button>
      <Button variant="destructive" disabled={isPending} onClick={() => report("failed")}>
        {t("fail")}
      </Button>
      <Button variant="outline" disabled={isPending} onClick={() => report("expired")}>
        {t("cancel")}
      </Button>
    </div>
  );
}
