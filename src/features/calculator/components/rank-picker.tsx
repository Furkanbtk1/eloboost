"use client";

import { cn } from "@/lib/utils";
import { stepLabel, type CatalogStep } from "@/features/pricing/engine";

/** Crest colours per tier name; unknown tiers fall back to the primary colour. */
const TIER_COLORS: Record<string, string> = {
  iron: "#6b7280",
  bronze: "#b45309",
  silver: "#94a3b8",
  gold: "#eab308",
  platinum: "#2dd4bf",
  emerald: "#10b981",
  diamond: "#60a5fa",
  ascendant: "#22c55e",
  immortal: "#e11d48",
  master: "#a855f7",
  grandmaster: "#ef4444",
  challenger: "#fbbf24",
  radiant: "#fde68a",
  champion: "#fb923c",
};

export const tierColor = (tier: string) => TIER_COLORS[tier.toLowerCase()] ?? "var(--primary)";

type Props = {
  steps: CatalogStep[];
  value: number;
  onChange: (position: number) => void;
  /** Lowest / highest selectable rung (inclusive). */
  min: number;
  max: number;
};

/** Tier buttons plus division buttons for one rung of a tiered ladder. */
export function RankPicker({ steps, value, onChange, min, max }: Props) {
  const selected = steps[value];
  const tiers = [...new Set(steps.map((step) => step.tier))];
  const allowed = (step: CatalogStep) => step.position >= min && step.position <= max;
  const tierSteps = steps.filter((step) => step.tier === selected?.tier);

  const pickTier = (tier: string) => {
    const candidates = steps.filter((step) => step.tier === tier && allowed(step));
    const sameDivision = candidates.find((step) => step.division === selected?.division);
    const next = sameDivision ?? candidates[0];
    if (next) onChange(next.position);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-10 rounded-full ring-4 ring-background"
          style={{ background: `radial-gradient(circle at 30% 30%, white, ${tierColor(selected?.tier ?? "")})` }}
        />
        <span className="text-lg font-semibold">{selected ? stepLabel(selected) : "–"}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {tiers.map((tier) => {
          const enabled = steps.some((step) => step.tier === tier && allowed(step));
          const active = selected?.tier === tier;
          return (
            <button
              key={tier}
              type="button"
              disabled={!enabled}
              aria-pressed={active}
              onClick={() => pickTier(tier)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-35",
                active ? "border-primary bg-primary/15 text-foreground" : "border-border hover:bg-accent",
              )}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: tierColor(tier) }} />
              <span className="truncate">{tier}</span>
            </button>
          );
        })}
      </div>

      {tierSteps.length > 1 && (
        <div className="flex gap-1.5">
          {tierSteps.map((step) => (
            <button
              key={step.position}
              type="button"
              disabled={!allowed(step)}
              aria-pressed={step.position === value}
              onClick={() => onChange(step.position)}
              className={cn(
                "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-35",
                step.position === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
              )}
            >
              {step.division}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
