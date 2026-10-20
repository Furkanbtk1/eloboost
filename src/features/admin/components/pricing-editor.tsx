"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  saveGamePricingAction,
  saveModifiersAction,
  savePlatformSettingsAction,
  saveRankStepsAction,
  saveRatingBracketsAction,
  saveServersAction,
} from "@/features/admin/pricing-actions";
import type { AdminPricing } from "@/features/admin/pricing";
import type { GameStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/action-result";

const str = (value: number | null) => (value === null ? "" : String(value));
const num = (value: string) => Number(value);
const numOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

function useSave() {
  const t = useTranslations("Admin.pricing");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const save = (action: (locale: string) => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action(locale);
      if (!result.success) return void toast.error(result.message);
      toast.success(t("saved"));
      router.refresh();
    });
  return { isPending, save };
}

function Section({ title, description, children, onSave, isPending }: {
  title: string;
  description?: string;
  children: ReactNode;
  onSave: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("Admin.pricing");
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="grid gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <Button size="sm" onClick={onSave} disabled={isPending}>
          {t("save")}
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  );
}

function Cell({ value, onChange, label, disabled }: { value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className="h-7 w-24 text-right tabular-nums"
    />
  );
}

export function PricingEditor({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing");
  const { slug } = pricing;

  return (
    <div className="grid gap-6">
      <GameSection pricing={pricing} />
      {pricing.rankSystem === "DIVISION" ? <StepsSection pricing={pricing} /> : <BracketsSection pricing={pricing} />}
      <ServersSection pricing={pricing} />
      <ModifiersSection pricing={pricing} />
      <p className="text-xs text-muted-foreground">{t("note", { slug })}</p>
    </div>
  );
}

function GameSection({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing.game");
  const { isPending, save } = useSave();
  const [basePrice, setBasePrice] = useState(str(pricing.basePrice));
  const [hourly, setHourly] = useState(str(pricing.coachingHourlyRate));
  const [status, setStatus] = useState<GameStatus>(pricing.status);

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() =>
        save((locale) =>
          saveGamePricingAction(locale, pricing.slug, { basePrice: num(basePrice), coachingHourlyRate: numOrNull(hourly), status }),
        )
      }
    >
      <div className="flex flex-wrap gap-6">
        <div className="grid gap-1.5">
          <Label htmlFor="game-base">{t("basePrice")}</Label>
          <Input id="game-base" type="number" step="0.01" min={0} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} className="w-32" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="game-hourly">{t("hourly")}</Label>
          <Input id="game-hourly" type="number" step="0.01" min={0} value={hourly} onChange={(event) => setHourly(event.target.value)} className="w-32" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="game-status">{t("status")}</Label>
          <NativeSelect id="game-status" value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>
            <option value="ACTIVE">{t("active")}</option>
            <option value="INACTIVE">{t("inactive")}</option>
          </NativeSelect>
        </div>
      </div>
    </Section>
  );
}

function StepsSection({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing.steps");
  const { isPending, save } = useSave();
  const [rows, setRows] = useState(
    pricing.steps.map((step) => ({ ...step, division: str(step.divisionPrice), win: str(step.winPrice), placement: str(step.placementPrice) })),
  );
  const update = (index: number, field: "division" | "win" | "placement", value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const top = rows.at(-1)?.position;

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() =>
        save((locale) =>
          saveRankStepsAction(
            locale,
            pricing.slug,
            rows.map((row) => ({
              position: row.position,
              divisionPrice: row.position === top ? null : num(row.division),
              winPrice: num(row.win),
              placementPrice: num(row.placement),
            })),
          ),
        )
      }
    >
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-normal">{t("rank")}</th>
            <th className="pb-2 text-right font-normal">{t("division")}</th>
            <th className="pb-2 text-right font-normal">{t("win")}</th>
            <th className="pb-2 text-right font-normal">{t("placement")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.position} className="border-t">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5">
                <div className="flex justify-end">
                  {row.position === top ? (
                    <span className="text-xs text-muted-foreground">{t("top")}</span>
                  ) : (
                    <Cell value={row.division} onChange={(value) => update(index, "division", value)} label={`${row.label} ${t("division")}`} />
                  )}
                </div>
              </td>
              <td className="py-1.5">
                <div className="flex justify-end">
                  <Cell value={row.win} onChange={(value) => update(index, "win", value)} label={`${row.label} ${t("win")}`} />
                </div>
              </td>
              <td className="py-1.5">
                <div className="flex justify-end">
                  <Cell value={row.placement} onChange={(value) => update(index, "placement", value)} label={`${row.label} ${t("placement")}`} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function BracketsSection({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing.brackets");
  const { isPending, save } = useSave();
  const [rows, setRows] = useState(pricing.brackets.map((bracket) => ({ ...bracket, per100: str(bracket.pricePer100), win: str(bracket.winPrice) })));
  const update = (index: number, field: "per100" | "win", value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() =>
        save((locale) =>
          saveRatingBracketsAction(
            locale,
            pricing.slug,
            rows.map((row) => ({ minRating: row.minRating, pricePer100: num(row.per100), winPrice: num(row.win) })),
          ),
        )
      }
    >
      <table className="w-full min-w-[26rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-normal">{t("range")}</th>
            <th className="pb-2 text-right font-normal">{t("per100")}</th>
            <th className="pb-2 text-right font-normal">{t("win")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const label = `${row.minRating}–${row.maxRating}`;
            return (
              <tr key={row.minRating} className="border-t">
                <td className="py-1.5 tabular-nums">{label}</td>
                <td className="py-1.5">
                  <div className="flex justify-end">
                    <Cell value={row.per100} onChange={(value) => update(index, "per100", value)} label={`${label} ${t("per100")}`} />
                  </div>
                </td>
                <td className="py-1.5">
                  <div className="flex justify-end">
                    <Cell value={row.win} onChange={(value) => update(index, "win", value)} label={`${label} ${t("win")}`} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function ServersSection({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing.servers");
  const { isPending, save } = useSave();
  const [rows, setRows] = useState(pricing.servers.map((server) => ({ ...server, percent: str(server.priceModifier) })));

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() =>
        save((locale) =>
          saveServersAction(
            locale,
            pricing.slug,
            rows.map((row) => ({ code: row.code, priceModifier: num(row.percent), isActive: row.isActive })),
          ),
        )
      }
    >
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-normal">{t("server")}</th>
            <th className="pb-2 font-normal">{t("region")}</th>
            <th className="pb-2 text-right font-normal">{t("percent")}</th>
            <th className="pb-2 text-right font-normal">{t("active")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.code} className="border-t">
              <td className="py-1.5">
                <span className="font-mono">{row.code}</span> <span className="text-muted-foreground">{row.name}</span>
              </td>
              <td className="py-1.5 text-muted-foreground">{row.region}</td>
              <td className="py-1.5">
                <div className="flex justify-end">
                  <Cell
                    value={row.percent}
                    label={`${row.code} ${t("percent")}`}
                    onChange={(value) => setRows((current) => current.map((entry, i) => (i === index ? { ...entry, percent: value } : entry)))}
                  />
                </div>
              </td>
              <td className="py-1.5 text-right">
                <Checkbox
                  checked={row.isActive}
                  aria-label={`${row.code} ${t("active")}`}
                  onCheckedChange={(checked) =>
                    setRows((current) => current.map((entry, i) => (i === index ? { ...entry, isActive: checked === true } : entry)))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function ModifiersSection({ pricing }: { pricing: AdminPricing }) {
  const t = useTranslations("Admin.pricing.modifiers");
  const { isPending, save } = useSave();
  const [rows, setRows] = useState(pricing.modifiers.map((modifier) => ({ ...modifier, percent: str(modifier.percentage) })));

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() =>
        save((locale) =>
          saveModifiersAction(
            locale,
            pricing.slug,
            rows.map((row) => ({ key: row.key, percentage: num(row.percent), isActive: row.isActive })),
          ),
        )
      }
    >
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-normal">{t("option")}</th>
            <th className="pb-2 font-normal">{t("category")}</th>
            <th className="pb-2 text-right font-normal">{t("percent")}</th>
            <th className="pb-2 text-right font-normal">{t("active")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className="border-t">
              <td className="py-1.5">
                {row.label}
                {row.isDefault && <span className="ml-2 text-xs text-muted-foreground">{t("default")}</span>}
              </td>
              <td className="py-1.5 text-muted-foreground">{t(`categories.${row.category}`)}</td>
              <td className="py-1.5">
                <div className="flex justify-end">
                  <Cell
                    value={row.percent}
                    label={`${row.label} ${t("percent")}`}
                    onChange={(value) => setRows((current) => current.map((entry, i) => (i === index ? { ...entry, percent: value } : entry)))}
                  />
                </div>
              </td>
              <td className="py-1.5 text-right">
                <Checkbox
                  checked={row.isActive}
                  disabled={row.isDefault}
                  aria-label={`${row.label} ${t("active")}`}
                  onCheckedChange={(checked) =>
                    setRows((current) => current.map((entry, i) => (i === index ? { ...entry, isActive: checked === true } : entry)))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function PlatformSettingsForm({ boosterSharePercent, minPayoutUsd }: { boosterSharePercent: number; minPayoutUsd: number }) {
  const t = useTranslations("Admin.pricing.settings");
  const { isPending, save } = useSave();
  const [share, setShare] = useState(str(boosterSharePercent));
  const [minPayout, setMinPayout] = useState(str(minPayoutUsd));

  return (
    <Section
      title={t("title")}
      description={t("description")}
      isPending={isPending}
      onSave={() => save((locale) => savePlatformSettingsAction(locale, { boosterSharePercent: num(share), minPayoutUsd: num(minPayout) }))}
    >
      <div className="flex flex-wrap gap-6">
        <div className="grid gap-1.5">
          <Label htmlFor="settings-share">{t("share")}</Label>
          <Input id="settings-share" type="number" step="0.01" min={1} max={99} value={share} onChange={(event) => setShare(event.target.value)} className="w-32" />
          <span className="text-xs text-muted-foreground">{t("platform", { percent: Number.isFinite(num(share)) ? 100 - num(share) : 0 })}</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="settings-min">{t("minPayout")}</Label>
          <Input id="settings-min" type="number" step="0.01" min={0} value={minPayout} onChange={(event) => setMinPayout(event.target.value)} className="w-32" />
        </div>
      </div>
    </Section>
  );
}
