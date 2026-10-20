"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setReviewVisibilityAction } from "@/features/admin/review-actions";

export function ReviewVisibility({ reviewId, isPublic }: { reviewId: string; isPublic: boolean }) {
  const t = useTranslations("Admin.reviews");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const result = await setReviewVisibilityAction(locale, reviewId, !isPublic);
      if (!result.success) return void toast.error(result.message);
      toast.success(isPublic ? t("hidden") : t("shown"));
      router.refresh();
    });

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={toggle}>
      {isPublic ? <EyeOffIcon /> : <EyeIcon />}
      {isPublic ? t("hide") : t("show")}
    </Button>
  );
}
