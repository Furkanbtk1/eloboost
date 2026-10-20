"use client";

import { useRouter } from "next/navigation";

import type { RealtimeEvent } from "@/lib/realtime/channels";
import { useRealtimeEvent } from "@/lib/realtime/client";

/** Re-renders the current page's server components when `event` arrives on `channel`. */
export function LiveRefresh({ channel, event }: { channel: string; event: RealtimeEvent }) {
  const router = useRouter();
  useRealtimeEvent(channel, event, () => router.refresh());
  return null;
}
