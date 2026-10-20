"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import type { Currency } from "@/generated/prisma/enums";

/** Price that counts smoothly to its new value (Framer Motion), without re-rendering per frame. */
export function AnimatedPrice({
  cents,
  currency,
  locale,
  className,
}: {
  cents: number;
  currency: Currency;
  locale: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(cents);
  const reduceMotion = useReducedMotion();
  const format = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = previous.current;
    previous.current = cents;
    if (reduceMotion || from === cents) {
      node.textContent = format.format(cents / 100);
      return;
    }
    const controls = animate(from, cents, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (value) => {
        node.textContent = format.format(value / 100);
      },
    });
    return () => controls.stop();
  }, [cents, format, reduceMotion]);

  const final = format.format(cents / 100);
  return (
    <>
      {/* Screen readers get only the final value, not every animation frame. */}
      <span ref={ref} aria-hidden className={className}>
        {final}
      </span>
      <span className="sr-only" aria-live="polite">
        {final}
      </span>
    </>
  );
}
