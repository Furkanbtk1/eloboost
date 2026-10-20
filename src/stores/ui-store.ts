import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Currency } from "@/generated/prisma/enums";

export type Theme = "dark" | "light";

/** localStorage key for persisted UI preferences. */
export const UI_STORE_KEY = "eloboost-ui";

type UIState = {
  theme: Theme;
  sidebarOpen: boolean;
  /** Display currency chosen by the user; null = default for the UI language. */
  currency: Currency | null;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCurrency: (currency: Currency) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      sidebarOpen: true,
      currency: null,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: UI_STORE_KEY,
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen, currency: state.currency }),
      // Rehydrated after mount (see Providers) so server and client markup match.
      skipHydration: true,
    },
  ),
);
