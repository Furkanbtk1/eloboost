"use client";

import { HeartHandshakeIcon, StarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startTipAction, submitReviewAction } from "@/features/feedback/actions";
import type { TipPercent } from "@/features/feedback/rules";
import type { PaymentProviderId } from "@/features/payments/types";
import { cn } from "@/lib/utils";

type TipOption = { percent: TipPercent; label: string; usd: number };

export function TipForm({
  orderNumber,
  options,
  providers,
  walletUsd,
  walletLabel,
}: {
  orderNumber: string;
  options: TipOption[];
  providers: PaymentProviderId[];
  walletUsd: number;
  /** Formatted wallet balance, e.g. "$12.00". */
  walletLabel: string;
}) {
  const t = useTranslations("Feedback.tip");
  const tMethods = useTranslations("Payments.methods");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [percent, setPercent] = useState<TipPercent>(10);
  const selected = options.find((option) => option.percent === percent) ?? options[0];

  const pay = (method: string) =>
    startTransition(async () => {
      const result = await startTipAction(locale, orderNumber, percent, method);
      if (!result.success) return void toast.error(result.message);
      if (result.data.redirectUrl) return window.location.assign(result.data.redirectUrl);
      toast.success(t("thanks"));
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("amount")}>
        {options.map((option) => (
          <button
            key={option.percent}
            type="button"
            role="radio"
            aria-checked={percent === option.percent}
            onClick={() => setPercent(option.percent)}
            className={cn(
              "grid gap-0.5 rounded-lg border px-3 py-2 text-center transition-colors",
              percent === option.percent ? "border-primary bg-primary/10" : "hover:border-primary/50",
            )}
          >
            <span className="font-semibold">%{option.percent}</span>
            <span className="text-xs text-muted-foreground">{option.label}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {walletUsd > 0 && (
          <Button variant="outline" disabled={isPending || walletUsd < selected.usd} onClick={() => pay("wallet")}>
            {t("fromWallet", { balance: walletLabel })}
          </Button>
        )}
        {providers.map((provider) => (
          <Button key={provider} variant="outline" disabled={isPending} onClick={() => pay(provider)}>
            {tMethods(`${provider}.name`)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}

export function ReviewForm({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("Feedback.review");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitReviewAction(locale, orderNumber, { rating, comment, isPublic });
      if (!result.success) return void toast.error(result.message);
      toast.success(t("thanks"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex gap-1" role="radiogroup" aria-label={t("rating")} onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={t("stars", { count: value })}
            onClick={() => setRating(value)}
            onPointerEnter={() => setHover(value)}
            className="rounded p-0.5"
          >
            <StarIcon
              className={cn(
                "size-7 transition-colors",
                (hover || rating) >= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="review-comment">{t("comment")}</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t("placeholder")}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isPublic} onCheckedChange={(value) => setIsPublic(value === true)} />
        {t("public")}
      </label>
      <Button type="submit" disabled={isPending || rating === 0} className="justify-self-start">
        {t("submit")}
      </Button>
    </form>
  );
}

export function SubmittedReview({ rating, comment, label }: { rating: number; comment: string | null; label: string }) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center gap-1" aria-label={label}>
        {[1, 2, 3, 4, 5].map((value) => (
          <StarIcon key={value} className={cn("size-4", value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        ))}
      </div>
      {comment && <p className="text-muted-foreground">{comment}</p>}
    </div>
  );
}

export function TipThanks({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <HeartHandshakeIcon className="size-4 text-primary" />
      {label}
    </p>
  );
}
