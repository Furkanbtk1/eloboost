"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveDisputeAction } from "@/features/disputes/actions";
import { DisputeResolution, type Currency } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Props = {
  disputeId: string;
  currency: Currency;
  total: number;
  boosterCut: number;
  hasBooster: boolean;
};

export function DisputeResolutionForm({ disputeId, currency, total, boosterCut, hasBooster }: Props) {
  const t = useTranslations("Admin.disputes.resolve");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolution, setResolution] = useState<DisputeResolution>("CONTINUED");
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");

  const money = (value: number) => format.number(value, { style: "currency", currency });
  const refundValue = Number(refund);
  const partialValid = refundValue > 0 && refundValue < total;
  const boosterShare = partialValid ? (boosterCut * (total - refundValue)) / total : 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await resolveDisputeAction(locale, disputeId, {
        resolution,
        note,
        ...(resolution === "PARTIAL_REFUND" ? { refundAmount: refundValue } : {}),
      });
      if (!result.success) return void toast.error(result.message);
      toast.success(t("done"));
      router.refresh();
    });
  };

  const options = Object.values(DisputeResolution).filter((value) => hasBooster || value !== "PARTIAL_REFUND");

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2" role="radiogroup" aria-label={t("decision")}>
        {options.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={resolution === value}
            onClick={() => setResolution(value)}
            className={cn(
              "grid gap-0.5 rounded-lg border p-3 text-left text-sm transition-colors",
              resolution === value ? "border-primary bg-primary/10" : "hover:border-primary/50",
            )}
          >
            <span className="font-medium">{t(`options.${value}.title`)}</span>
            <span className="text-xs text-muted-foreground">
              {t(`options.${value}.body`, { total: money(total) })}
            </span>
          </button>
        ))}
      </div>

      {resolution === "PARTIAL_REFUND" && (
        <div className="grid gap-2">
          <Label htmlFor="dispute-refund">{t("refundAmount", { currency })}</Label>
          <Input
            id="dispute-refund"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={total}
            step="0.01"
            value={refund}
            onChange={(event) => setRefund(event.target.value)}
            className="max-w-48"
          />
          {partialValid && <p className="text-xs text-muted-foreground">{t("boosterShare", { amount: money(boosterShare) })}</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="dispute-note">{t("note")}</Label>
        <Textarea id="dispute-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1000} />
        <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
      </div>

      <Button
        type="submit"
        disabled={isPending || note.trim().length < 5 || (resolution === "PARTIAL_REFUND" && !partialValid)}
        className="justify-self-start"
      >
        {t("submit")}
      </Button>
    </form>
  );
}
