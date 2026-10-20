"use client";

import {
  BitcoinIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FlaskConicalIcon,
  LockIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { payWithWalletAction, startPaymentAction } from "@/features/payments/actions";
import type { PaymentProviderId } from "@/features/payments/types";
import { cn } from "@/lib/utils";

const ICONS: Record<PaymentProviderId, LucideIcon> = {
  stripe: CreditCardIcon,
  coinbase: BitcoinIcon,
  sandbox: FlaskConicalIcon,
};

export function PaymentMethods({
  orderNumber,
  providers,
  amount,
  wallet,
}: {
  orderNumber: string;
  providers: PaymentProviderId[];
  /** Formatted order total, e.g. "$52.80". */
  amount: string;
  /** Shown when the customer has a wallet balance (e.g. from a refund). */
  wallet: { balance: string; enough: boolean } | null;
}) {
  const t = useTranslations("Payments");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<PaymentProviderId | "wallet" | null>(null);

  if (providers.length === 0 && !wallet) return <p className="text-sm text-muted-foreground">{t("none")}</p>;

  const payFromWallet = () => {
    setSelected("wallet");
    startTransition(async () => {
      const result = await payWithWalletAction(locale, orderNumber);
      if (!result.success) {
        toast.error(result.message);
        if (result.code === 409) router.refresh();
        return;
      }
      router.push(result.data.redirectTo);
    });
  };

  const pay = (provider: PaymentProviderId) => {
    setSelected(provider);
    startTransition(async () => {
      const result = await startPaymentAction(locale, orderNumber, provider);
      if (!result.success) {
        toast.error(result.message);
        if (result.code === 409) router.refresh(); // already paid: show the new state
        return;
      }
      // Hosted payment page of the provider (or the sandbox page in development).
      window.location.assign(result.data.redirectUrl);
    });
  };

  return (
    <div className="grid gap-3">
      {wallet && (
        <button
          type="button"
          disabled={isPending || !wallet.enough}
          onClick={payFromWallet}
          className={cn(
            "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
            "hover:border-primary/60 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
            isPending && selected === "wallet" && "border-primary",
          )}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <WalletIcon className="size-5" />
          </span>
          <span className="grid flex-1 gap-0.5">
            <span className="font-medium">{t("wallet.name")}</span>
            <span className="text-sm text-muted-foreground">
              {wallet.enough ? t("wallet.balance", { balance: wallet.balance }) : t("wallet.insufficient", { balance: wallet.balance })}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
            {t("pay", { amount })}
            <ChevronRightIcon className="size-4" />
          </span>
        </button>
      )}
      {providers.map((provider) => {
        const Icon = ICONS[provider];
        const busy = isPending && selected === provider;
        return (
          <button
            key={provider}
            type="button"
            disabled={isPending}
            onClick={() => pay(provider)}
            className={cn(
              "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors",
              "hover:border-primary/60 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
              busy && "border-primary",
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="grid flex-1 gap-0.5">
              <span className="font-medium">{t(`methods.${provider}.name`)}</span>
              <span className="text-sm text-muted-foreground">{t(`methods.${provider}.description`)}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
              {t("pay", { amount })}
              <ChevronRightIcon className={cn("size-4", busy && "animate-pulse")} />
            </span>
          </button>
        );
      })}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3" />
        {t("secure")}
      </p>
    </div>
  );
}
