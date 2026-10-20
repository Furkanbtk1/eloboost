"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import type { RealtimeClientConfig } from "@/lib/realtime/channels";
import { RealtimeProvider } from "@/lib/realtime/client";
import { useUIStore, type Theme } from "@/stores/ui-store";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * The page renders dark by default (see the root layout). After mount the
 * persisted theme is loaded and every store change is mirrored onto <html>.
 * A short flash is possible for users who chose light, but no inline <script>
 * is used: React warns about script tags when the layout re-renders on the client.
 */
function ThemeSync() {
  useEffect(() => {
    const unsubscribe = useUIStore.subscribe((state, previous) => {
      if (state.theme !== previous.theme) applyTheme(state.theme);
    });
    void useUIStore.persist.rehydrate();
    return unsubscribe;
  }, []);

  return null;
}

function AppToaster() {
  const theme = useUIStore((state) => state.theme);
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}

export function Providers({ realtime, children }: { realtime: RealtimeClientConfig | null; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider config={realtime}>
        <ThemeSync />
        {children}
        <AppToaster />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
