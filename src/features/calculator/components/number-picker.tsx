"use client";

import { useFormatter } from "next-intl";

import { Slider } from "@/components/ui/slider";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
};

/** Slider with a large readout, used for ratings, wins, games and hours. */
export function NumberPicker({ label, value, onChange, min, max, step = 1 }: Props) {
  const format = useFormatter();
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{format.number(value)}</span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{format.number(min)}</span>
        <span>{format.number(max)}</span>
      </div>
    </div>
  );
}
