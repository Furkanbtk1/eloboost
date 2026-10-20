"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { createPromoAction, setPromoActiveAction } from "@/features/admin/promo-actions";
import type { DiscountType } from "@/generated/prisma/enums";

const optionalNumber = (value: string) => (value.trim() === "" ? null : Number(value));

export function CreatePromoForm() {
  const t = useTranslations("Admin.promos.form");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPromoAction(locale, {
        code,
        discountType,
        discountValue: Number(discountValue),
        maxUses: optionalNumber(maxUses),
        expiresOn: expiresOn || null,
        minOrderAmount: optionalNumber(minOrderAmount),
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        return void toast.error(result.message);
      }
      setErrors({});
      setCode("");
      toast.success(t("created"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
      <FormField
        id="promo-code"
        label={t("code")}
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        error={errors.code?.[0]}
        maxLength={30}
        placeholder="SUMMER25"
        autoComplete="off"
      />
      <div className="grid gap-1.5">
        <Label htmlFor="promo-type">{t("type")}</Label>
        <NativeSelect id="promo-type" value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)}>
          <option value="PERCENTAGE">{t("percentage")}</option>
          <option value="FIXED">{t("fixed")}</option>
        </NativeSelect>
      </div>
      <FormField
        id="promo-value"
        label={discountType === "PERCENTAGE" ? t("valuePercent") : t("valueFixed")}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={discountValue}
        onChange={(event) => setDiscountValue(event.target.value)}
        error={errors.discountValue?.[0]}
      />
      <FormField
        id="promo-max"
        label={t("maxUses")}
        type="number"
        min={1}
        step={1}
        value={maxUses}
        onChange={(event) => setMaxUses(event.target.value)}
        error={errors.maxUses?.[0]}
        placeholder={t("unlimited")}
      />
      <FormField
        id="promo-expires"
        label={t("expiresOn")}
        type="date"
        value={expiresOn}
        onChange={(event) => setExpiresOn(event.target.value)}
        error={errors.expiresOn?.[0]}
      />
      <FormField
        id="promo-min"
        label={t("minOrder")}
        type="number"
        min={0}
        step="0.01"
        value={minOrderAmount}
        onChange={(event) => setMinOrderAmount(event.target.value)}
        error={errors.minOrderAmount?.[0]}
        placeholder={t("none")}
      />
      <Button type="submit" disabled={isPending || code.length < 3} className="justify-self-start sm:col-span-2 lg:col-span-3">
        {t("create")}
      </Button>
    </form>
  );
}

export function PromoActiveSwitch({ promoId, isActive, label }: { promoId: string; isActive: boolean; label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Switch
      checked={isActive}
      disabled={isPending}
      aria-label={label}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const result = await setPromoActiveAction(locale, promoId, checked);
          if (!result.success) return void toast.error(result.message);
          router.refresh();
        })
      }
    />
  );
}
