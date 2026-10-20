"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { claimOrderAction } from "@/features/booster/actions";

export function ClaimButton({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("Booster.pool");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const claim = () =>
    startTransition(async () => {
      const result = await claimOrderAction(locale, orderNumber);
      if (!result.success) {
        toast.error(result.message);
        router.refresh(); // someone else may have taken it: refresh the pool
        return;
      }
      toast.success(t("claimed", { orderNumber }));
      router.push(result.data.redirectTo);
    });

  return (
    <Button onClick={claim} disabled={isPending}>
      {t("claim")}
    </Button>
  );
}
