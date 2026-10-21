import { BitcoinIcon, CreditCardIcon, SmartphoneIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Accepted payment methods as neutral badges. Only methods that are actually
 * wired up appear (cards via Stripe, wallets through Stripe, crypto through
 * Coinbase Commerce); add PayPal etc. here when a provider for it exists.
 */
const BADGES: { label: string; mark: ReactNode }[] = [
  { label: "Visa", mark: <span className="text-[0.95rem] font-extrabold tracking-tight italic text-sky-300">VISA</span> },
  {
    label: "Mastercard",
    mark: (
      <span className="relative flex h-5 w-8" aria-hidden>
        <span className="absolute left-0 size-5 rounded-full bg-red-500/90" />
        <span className="absolute right-0 size-5 rounded-full bg-amber-400/90 mix-blend-screen" />
      </span>
    ),
  },
  { label: "Apple Pay", mark: <span className="flex items-center gap-1 text-xs font-semibold"><SmartphoneIcon className="size-3.5" />Pay</span> },
  { label: "Google Pay", mark: <span className="flex items-center gap-1 text-xs font-semibold"><SmartphoneIcon className="size-3.5" />G Pay</span> },
  { label: "Stripe", mark: <span className="text-sm font-bold tracking-tight text-violet-300">stripe</span> },
  { label: "Cards", mark: <CreditCardIcon className="size-5" /> },
  { label: "Bitcoin", mark: <span className="flex items-center gap-1 text-xs font-semibold text-amber-300"><BitcoinIcon className="size-4" />BTC</span> },
  { label: "USDT", mark: <span className="text-xs font-bold text-emerald-300">USDT</span> },
];

export function PaymentBadges() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2.5">
      {BADGES.map((badge) => (
        <li
          key={badge.label}
          title={badge.label}
          className="grid h-9 min-w-14 place-items-center rounded-md border border-border/70 bg-background/60 px-3 text-muted-foreground"
        >
          <span className="sr-only">{badge.label}</span>
          <span aria-hidden>{badge.mark}</span>
        </li>
      ))}
    </ul>
  );
}
