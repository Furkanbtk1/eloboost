"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cancelPayoutAction, requestPayoutAction, savePayoutDetailsAction } from "@/features/payouts/actions";
import { CRYPTO_NETWORKS } from "@/features/payouts/details";
import type { PayoutMethod } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

function useAction() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (action: (locale: string) => Promise<ActionResult>, success: string, onError?: (result: ActionResult) => void) =>
    startTransition(async () => {
      const result = await action(locale);
      if (!result.success) {
        onError?.(result);
        return void toast.error(result.message);
      }
      toast.success(success);
      router.refresh();
    });
  return { isPending, run };
}

export function PayoutDetailsForm({ current }: { current: PayoutMethod | null }) {
  const t = useTranslations("Payouts.details");
  const { isPending, run } = useAction();
  const [method, setMethod] = useState<PayoutMethod>(current ?? "CRYPTO");
  const [network, setNetwork] = useState<(typeof CRYPTO_NETWORKS)[number]>("USDT_TRC20");
  const [address, setAddress] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = method === "CRYPTO" ? { method, network, address } : { method, accountHolder, iban };
    run(
      (locale) => savePayoutDetailsAction(locale, input),
      t("saved"),
      (result) => setErrors(result.success ? {} : (result.fieldErrors ?? {})),
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("method")}>
        {(["CRYPTO", "BANK_TRANSFER"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              method === value ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:border-primary/50",
            )}
          >
            {t(`methods.${value}`)}
          </button>
        ))}
      </div>

      {method === "CRYPTO" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="payout-network">{t("network")}</Label>
            <NativeSelect
              id="payout-network"
              value={network}
              onChange={(event) => setNetwork(event.target.value as (typeof CRYPTO_NETWORKS)[number])}
            >
              {CRYPTO_NETWORKS.map((value) => (
                <option key={value} value={value}>
                  {t(`networks.${value}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormField
            id="payout-address"
            label={t("address")}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            error={errors.address?.[0]}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
          />
        </>
      ) : (
        <>
          <FormField
            id="payout-holder"
            label={t("accountHolder")}
            value={accountHolder}
            onChange={(event) => setAccountHolder(event.target.value)}
            error={errors.accountHolder?.[0]}
            autoComplete="name"
            maxLength={100}
          />
          <FormField
            id="payout-iban"
            label={t("iban")}
            value={iban}
            onChange={(event) => setIban(event.target.value)}
            error={errors.iban?.[0]}
            autoComplete="off"
            spellCheck={false}
            maxLength={42}
          />
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <Button type="submit" disabled={isPending} className="justify-self-start">
        {t("save")}
      </Button>
    </form>
  );
}

export function PayoutRequestForm({
  balance,
  minPayout,
  disabledReason,
}: {
  balance: number;
  minPayout: number;
  /** Shown instead of the form when a request can't be made. */
  disabledReason: string | null;
}) {
  const t = useTranslations("Payouts.request");
  const { isPending, run } = useAction();
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [error, setError] = useState<string>();

  if (disabledReason) return <p className="text-sm text-muted-foreground">{disabledReason}</p>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(
      (locale) => requestPayoutAction(locale, Number(amount)),
      t("sent"),
      (result) => setError(result.success ? undefined : result.fieldErrors?.amount?.[0]),
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormField
        id="payout-amount"
        label={t("amount")}
        type="number"
        inputMode="decimal"
        min={minPayout}
        max={balance}
        step="0.01"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={error}
      />
      <p className="text-xs text-muted-foreground">{t("hint", { min: minPayout })}</p>
      <Button type="submit" disabled={isPending || !amount} className="justify-self-start">
        {t("submit")}
      </Button>
    </form>
  );
}

export function CancelPayoutButton({ requestId }: { requestId: string }) {
  const t = useTranslations("Payouts.request");
  const { isPending, run } = useAction();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => run((locale) => cancelPayoutAction(locale, requestId), t("cancelled"))}
    >
      {t("cancel")}
    </Button>
  );
}
