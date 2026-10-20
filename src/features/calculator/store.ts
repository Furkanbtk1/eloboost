import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PromoTerms, QuoteInput } from "@/features/pricing/engine";

type CalculatorState = {
  /** Last selection per game slug, so switching games or signing in doesn't lose it. */
  configs: Record<string, QuoteInput>;
  promo: PromoTerms | null;
  saveConfig: (slug: string, config: QuoteInput) => void;
  setPromo: (promo: PromoTerms | null) => void;
};

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      configs: {},
      promo: null,
      saveConfig: (slug, config) => set((state) => ({ configs: { ...state.configs, [slug]: config } })),
      setPromo: (promo) => set({ promo }),
    }),
    {
      name: "eloboost-calculator",
      // Per tab: survives the sign-in round trip, gone when the tab closes.
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrated by the calculator after mount so server and client markup match.
      skipHydration: true,
    },
  ),
);
