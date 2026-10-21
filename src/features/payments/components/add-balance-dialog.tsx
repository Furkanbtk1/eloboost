"use client";

import { PlusIcon, WalletIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { startDepositAction } from "@/features/payments/actions";
import { DEPOSIT_MAX_USD, DEPOSIT_MIN_USD } from "@/features/payments/deposit";
import type { PaymentProviderId } from "@/features/payments/types";
import { cn } from "@/lib/utils";

const PRESETS = [10, 25, 50, 100] as const;

/** "Add balance" button and modal: pick or type an amount, then pay with an offered provider. */
export function AddBalanceDialog({ providers }: { providers: PaymentProviderId[] }) {
  const t = useTranslations("Wallet");
  const tMethods = useTranslations("Payments.methods");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("25");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const pay = (provider: PaymentProviderId) =>
    startTransition(async () => {
      const result = await startDepositAction(locale, Number(amount), provider);
      if (!result.success) {
        setError(result.fieldErrors?.amount?.[0]);
        return void toast.error(result.message);
      }
      window.location.assign(result.data.redirectUrl);
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          {t("button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <WalletIcon className="size-5 text-primary" />
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description", { min: DEPOSIT_MIN_USD, max: DEPOSIT_MAX_USD })}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={t("presets")}>
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(String(preset));
                  setError(undefined);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  Number(amount) === preset ? "border-primary bg-primary/10" : "hover:border-primary/50",
                )}
              >
                ${preset}
              </button>
            ))}
          </div>
          <FormField
            id="deposit-amount"
            label={t("amount")}
            type="number"
            inputMode="decimal"
            min={DEPOSIT_MIN_USD}
            max={DEPOSIT_MAX_USD}
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(undefined);
            }}
            error={error}
          />
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMethods")}</p>
          ) : (
            <div className="grid gap-2">
              {providers.map((provider) => (
                <Button key={provider} variant="outline" disabled={isPending || !amount} onClick={() => pay(provider)}>
                  {t("payWith", { method: tMethods(`${provider}.name`) })}
                </Button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("close")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
