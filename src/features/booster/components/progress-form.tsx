"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportProgressAction } from "@/features/booster/actions";

type Props = {
  orderNumber: string;
  label: string;
  value: number;
} & (
  /** Pick a rung of the ladder. */
  | { kind: "rank"; options: { value: number; label: string }[] }
  /** Free number: rating, or wins/games/hours done. */
  | { kind: "number"; min: number; max: number }
);

export function ProgressForm(props: Props) {
  const t = useTranslations("Booster.workspace");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(props.value);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await reportProgressAction(locale, props.orderNumber, value);
      if (!result.success) return void toast.error(result.message);
      toast.success(t("progressSaved"));
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <div className="grid min-w-48 flex-1 gap-1.5">
        <Label htmlFor="progress">{props.label}</Label>
        {props.kind === "rank" ? (
          <Select value={String(value)} onValueChange={(next) => setValue(Number(next))}>
            <SelectTrigger id="progress" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.options.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="progress"
            type="number"
            inputMode="numeric"
            min={props.min}
            max={props.max}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
        )}
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {t("saveProgress")}
      </Button>
    </form>
  );
}
