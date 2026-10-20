"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvePayoutAction, markPayoutPaidAction, rejectPayoutAction } from "@/features/admin/payout-actions";
import type { PayoutStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";

/** Finance actions for one request; what is offered depends on its status. */
export function PayoutReview({ requestId, status }: { requestId: string; status: PayoutStatus }) {
  const t = useTranslations("Admin.payouts.actions");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"reject" | "paid" | null>(null);
  const [value, setValue] = useState("");

  const run = (action: () => Promise<ActionResult>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.success) return void toast.error(result.message);
      toast.success(done);
      setMode(null);
      setValue("");
      router.refresh();
    });

  if (status !== "PENDING" && status !== "APPROVED") return null;

  if (mode) {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "reject") run(() => rejectPayoutAction(locale, requestId, value), t("rejected"));
          else run(() => markPayoutPaidAction(locale, requestId, value), t("paid"));
        }}
      >
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={mode === "reject" ? t("reasonPlaceholder") : t("referencePlaceholder")}
          aria-label={mode === "reject" ? t("reasonPlaceholder") : t("referencePlaceholder")}
          className="max-w-xs"
          maxLength={mode === "reject" ? 500 : 120}
        />
        <Button type="submit" size="sm" variant={mode === "reject" ? "destructive" : "default"} disabled={isPending || !value.trim()}>
          {mode === "reject" ? t("confirmReject") : t("confirmPaid")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
          {t("cancel")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <Button size="sm" disabled={isPending} onClick={() => run(() => approvePayoutAction(locale, requestId), t("approved"))}>
          {t("approve")}
        </Button>
      )}
      {status === "APPROVED" && (
        <Button size="sm" disabled={isPending} onClick={() => setMode("paid")}>
          {t("markPaid")}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setMode("reject")}>
        {t("reject")}
      </Button>
    </div>
  );
}
