"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Day = { day: string; amount: number; orders: number };

/** Daily paid revenue, one column per UTC day. Single series: the title names it, no legend. */
export function RevenueChart({ data }: { data: Day[] }) {
  const t = useTranslations("Admin.overview.chart");
  const format = useFormatter();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(...data.map((entry) => entry.amount), 0);
  const usd = (value: number) =>
    format.number(value, { style: "currency", currency: "USD", notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: value >= 10_000 ? 1 : 0 });
  const label = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const labelled = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  const current = active === null ? null : data[active];

  return (
    <figure className="grid gap-3">
      <div className="relative">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{usd(max)}</span>
        </div>
        <div className="relative mt-1 h-40 border-t border-dashed border-border">
          <div className="absolute inset-0 flex items-end gap-0.5 border-b border-border">
            {data.map((entry, index) => (
              <button
                key={entry.day}
                type="button"
                className="group flex h-full flex-1 items-end justify-center outline-none"
                aria-label={t("bar", { day: label(entry.day), amount: usd(entry.amount), orders: entry.orders })}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <span
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] bg-primary transition-[filter]",
                    "group-hover:brightness-125 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  )}
                  style={{ height: max > 0 ? `${(entry.amount / max) * 100}%` : 0 }}
                />
              </button>
            ))}
          </div>
          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            >
              <div className="text-sm font-semibold text-popover-foreground">{usd(current.amount)}</div>
              <div className="whitespace-nowrap text-muted-foreground">
                {label(current.day)} · {t("orders", { count: current.orders })}
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-1.5 h-4 text-xs text-muted-foreground">
          {data.map((entry, index) =>
            labelled.has(index) ? (
              <span
                key={entry.day}
                className={cn(
                  "absolute whitespace-nowrap",
                  index === 0 ? "left-0" : index === data.length - 1 ? "right-0" : "-translate-x-1/2",
                )}
                style={index !== 0 && index !== data.length - 1 ? { left: `${((index + 0.5) / data.length) * 100}%` } : undefined}
              >
                {label(entry.day)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t("table")}</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">{t("day")}</th>
              <th className="py-1 text-right font-normal">{t("revenue")}</th>
              <th className="py-1 text-right font-normal">{t("ordersColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.day} className="border-t">
                <td className="py-1">{label(entry.day)}</td>
                <td className="py-1 text-right tabular-nums">{usd(entry.amount)}</td>
                <td className="py-1 text-right tabular-nums">{entry.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
