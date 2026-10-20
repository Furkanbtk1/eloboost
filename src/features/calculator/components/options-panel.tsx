"use client";

import { useMessages, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lpGainOptions } from "@/features/calculator/config";
import { applicableModifiers, type CatalogModifier, type PricingCatalog, type QuoteInput } from "@/features/pricing/engine";

export function useModifierText() {
  const t = useTranslations("Calculator");
  const messages = useMessages();
  // Translations exist for the seeded keys; admin-created options fall back to their stored label.
  const labels: Record<string, string> = messages.Calculator.modifierLabels;
  const descriptions: Record<string, string> = messages.Calculator.modifierDescriptions;
  return {
    label: (modifier: Pick<CatalogModifier, "key" | "label">) => labels[modifier.key] ?? modifier.label,
    description: (modifier: Pick<CatalogModifier, "key" | "description">) =>
      descriptions[modifier.key] ?? modifier.description ?? "",
    percent: (bp: number) => (bp === 0 ? t("free") : `${bp > 0 ? "+" : "−"}${Math.abs(bp) / 100}%`),
  };
}

type Props = {
  catalog: PricingCatalog;
  config: QuoteInput;
  onChange: (config: QuoteInput) => void;
};

export function OptionsPanel({ catalog, config, onChange }: Props) {
  const t = useTranslations("Calculator");
  const text = useModifierText();
  const lpOptions = lpGainOptions(catalog, config.orderType);
  const addOns = applicableModifiers(catalog, config.orderType, "ADD_ON");

  const toggleAddOn = (key: string, checked: boolean) =>
    onChange({
      ...config,
      addOns: checked ? [...config.addOns, key] : config.addOns.filter((existing) => existing !== key),
    });

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="server">{t("server")}</Label>
        <Select value={config.server} onValueChange={(server) => onChange({ ...config, server })}>
          <SelectTrigger id="server" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {catalog.servers.map((server) => (
              <SelectItem key={server.code} value={server.code}>
                <span className="font-medium">{server.code}</span>
                <span className="text-muted-foreground">{server.name}</span>
                {server.percentBp !== 0 && <span className="ml-auto text-xs text-muted-foreground">{text.percent(server.percentBp)}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {lpOptions.length > 0 && (
        <div className="grid gap-2">
          <Label>{t("lpGain")}</Label>
          <RadioGroup
            value={config.lpGain ?? undefined}
            onValueChange={(lpGain) => onChange({ ...config, lpGain })}
            className="grid gap-2 sm:grid-cols-2"
          >
            {lpOptions.map((modifier) => (
              <Label
                key={modifier.key}
                htmlFor={`lp-${modifier.key}`}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal has-data-[state=checked]:border-primary"
              >
                <RadioGroupItem id={`lp-${modifier.key}`} value={modifier.key} />
                <span className="flex-1 text-sm">{text.label(modifier)}</span>
                <Badge variant="secondary">{text.percent(modifier.percentBp)}</Badge>
              </Label>
            ))}
          </RadioGroup>
        </div>
      )}

      {addOns.length > 0 && (
        <div className="grid gap-2">
          <Label>{t("addOns")}</Label>
          <div className="grid gap-2">
            {addOns.map((modifier) => (
              <Label
                key={modifier.key}
                htmlFor={`addon-${modifier.key}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal has-data-[state=checked]:border-primary"
              >
                <Checkbox
                  id={`addon-${modifier.key}`}
                  checked={config.addOns.includes(modifier.key)}
                  onCheckedChange={(checked) => toggleAddOn(modifier.key, checked === true)}
                  className="mt-0.5"
                />
                <span className="grid flex-1 gap-0.5">
                  <span className="text-sm font-medium">{text.label(modifier)}</span>
                  <span className="text-xs text-muted-foreground">{text.description(modifier)}</span>
                </span>
                <Badge variant="secondary">{text.percent(modifier.percentBp)}</Badge>
              </Label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
