"use client";

import Pusher, { type Channel } from "pusher-js";
import { createContext, use, useEffect, useEffectEvent, useState, type ReactNode } from "react";

import type { RealtimeClientConfig, RealtimeEvent } from "./channels";

type Realtime = {
  subscribe(name: string): Channel;
  release(name: string): void;
};

/** Grace period before closing an unused socket, so page navigations don't reconnect. */
const IDLE_DISCONNECT_MS = 10_000;

/**
 * One socket per tab, opened on the first subscription (visitors who never
 * subscribe never connect) and closed shortly after the last one is released.
 * Channels are reference counted because several components can share one.
 */
function createRealtime(config: RealtimeClientConfig): Realtime {
  let client: Pusher | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const counts = new Map<string, number>();

  const connect = () =>
    (client ??= new Pusher(config.key, {
      cluster: config.cluster,
      ...(config.host
        ? {
            wsHost: config.host,
            wsPort: config.port ?? 80,
            wssPort: config.port ?? 443,
            forceTLS: config.tls,
            enabledTransports: ["ws", "wss"],
          }
        : {}),
      channelAuthorization: { endpoint: "/api/realtime/auth", transport: "ajax" },
    }));

  return {
    subscribe(name) {
      clearTimeout(idleTimer);
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return connect().subscribe(name);
    },
    release(name) {
      const remaining = (counts.get(name) ?? 1) - 1;
      if (remaining > 0) return void counts.set(name, remaining);
      counts.delete(name);
      client?.unsubscribe(name);
      if (counts.size > 0) return;
      idleTimer = setTimeout(() => {
        client?.disconnect();
        client = null;
      }, IDLE_DISCONNECT_MS);
    },
  };
}

const RealtimeContext = createContext<Realtime | null>(null);

export function RealtimeProvider({ config, children }: { config: RealtimeClientConfig | null; children: ReactNode }) {
  const [realtime] = useState(() => (config ? createRealtime(config) : null));
  return <RealtimeContext value={realtime}>{children}</RealtimeContext>;
}

/**
 * Calls `onEvent` when `event` arrives on `channelName`, and again after a
 * reconnect (signals sent while offline are lost, so the caller reloads).
 * Does nothing when realtime is not configured or `channelName` is null.
 */
export function useRealtimeEvent(channelName: string | null, event: RealtimeEvent, onEvent: () => void) {
  const realtime = use(RealtimeContext);
  const handle = useEffectEvent(onEvent);

  useEffect(() => {
    if (!realtime || !channelName) return;
    const channel = realtime.subscribe(channelName);
    let subscribedBefore = channel.subscribed;
    const onSignal = () => handle();
    const onSubscribed = () => {
      if (subscribedBefore) handle();
      subscribedBefore = true;
    };
    channel.bind(event, onSignal);
    channel.bind("pusher:subscription_succeeded", onSubscribed);
    return () => {
      channel.unbind(event, onSignal);
      channel.unbind("pusher:subscription_succeeded", onSubscribed);
      realtime.release(channelName);
    };
  }, [realtime, channelName, event]);
}
