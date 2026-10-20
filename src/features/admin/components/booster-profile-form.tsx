"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { saveBoosterProfileAction } from "@/features/admin/user-actions";
import { BoosterStatus } from "@/generated/prisma/enums";

export type GameLadder = {
  slug: string;
  name: string;
  rankSystem: "DIVISION" | "RATING";
  steps: { position: number; label: string }[];
  maxRating: number;
};

type Rank = { position?: number; rating?: number };

type Props = {
  userId: string;
  status: BoosterStatus;
  games: string[];
  ranks: Record<string, Rank>;
  ladders: GameLadder[];
};

/** Approve / suspend a booster and set the games and verified ranks the order pool matches on. */
export function BoosterProfileForm({ userId, status: savedStatus, games: savedGames, ranks: savedRanks, ladders }: Props) {
  const t = useTranslations("Admin.users.booster");
  const tStatus = useTranslations("Booster.status");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(savedStatus);
  const [games, setGames] = useState(new Set(savedGames));
  const [ranks, setRanks] = useState<Record<string, Rank>>(savedRanks);

  const toggle = (slug: string, checked: boolean) =>
    setGames((current) => {
      const next = new Set(current);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const result = await saveBoosterProfileAction(locale, userId, { status, games: [...games], ranks });
      if (!result.success) return void toast.error(result.message);
      toast.success(t("saved"));
      router.refresh();
    });

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="booster-status">{t("status")}</Label>
        <NativeSelect
          id="booster-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as BoosterStatus)}
          className="w-fit"
        >
          {Object.values(BoosterStatus).map((value) => (
            <option key={value} value={value}>
              {tStatus(value)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">{t("games")}</legend>
        {ladders.map((ladder) => {
          const checked = games.has(ladder.slug);
          const rank = ranks[ladder.slug];
          return (
            <div key={ladder.slug} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(value) => toggle(ladder.slug, value === true)} />
                {ladder.name}
              </label>
              {checked &&
                (ladder.rankSystem === "DIVISION" ? (
                  <NativeSelect
                    aria-label={t("rankFor", { game: ladder.name })}
                    value={rank?.position ?? ""}
                    onChange={(event) =>
                      setRanks((current) => ({ ...current, [ladder.slug]: { position: Number(event.target.value) } }))
                    }
                  >
                    <option value="" disabled>
                      {t("pickRank")}
                    </option>
                    {ladder.steps.map((step) => (
                      <option key={step.position} value={step.position}>
                        {step.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    max={ladder.maxRating}
                    step={1}
                    aria-label={t("rankFor", { game: ladder.name })}
                    placeholder={t("rating")}
                    value={rank?.rating ?? ""}
                    onChange={(event) =>
                      setRanks((current) => ({
                        ...current,
                        [ladder.slug]: event.target.value === "" ? {} : { rating: Number(event.target.value) },
                      }))
                    }
                    className="max-w-40"
                  />
                ))}
            </div>
          );
        })}
      </fieldset>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <Button onClick={save} disabled={isPending} className="justify-self-start">
        {t("save")}
      </Button>
    </div>
  );
}
