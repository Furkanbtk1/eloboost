import "server-only";

import { after } from "next/server";
import Pusher from "pusher";

import { env } from "@/lib/env";

import { channels, events, type RealtimeClientConfig, type RealtimeEvent } from "./channels";

/** Server client, or null when PUSHER_* is not configured. */
export const pusher =
  env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET
    ? new Pusher({
        appId: env.PUSHER_APP_ID,
        key: env.PUSHER_KEY,
        secret: env.PUSHER_SECRET,
        cluster: env.PUSHER_CLUSTER,
        useTLS: env.PUSHER_USE_TLS,
        ...(env.PUSHER_HOST ? { host: env.PUSHER_HOST, port: String(env.PUSHER_PORT ?? (env.PUSHER_USE_TLS ? 443 : 80)) } : {}),
      })
    : null;

export function realtimeClientConfig(): RealtimeClientConfig | null {
  if (!pusher || !env.PUSHER_KEY) return null;
  return {
    key: env.PUSHER_KEY,
    cluster: env.PUSHER_CLUSTER,
    host: env.PUSHER_HOST,
    port: env.PUSHER_PORT,
    tls: env.PUSHER_USE_TLS,
  };
}

type Signal = { channel: string; event: RealtimeEvent };

/** Pusher accepts at most 10 events per batch call. */
const BATCH_SIZE = 10;

/**
 * Sends signals once the response has been sent, so a slow or unreachable
 * realtime server never delays or fails the mutation. The database stays the
 * source of truth; a missed signal only means the other side refreshes later.
 */
export function broadcast(...signals: Signal[]): void {
  const client = pusher;
  if (!client || signals.length === 0) return;
  after(async () => {
    try {
      for (let index = 0; index < signals.length; index += BATCH_SIZE) {
        await client.triggerBatch(
          signals.slice(index, index + BATCH_SIZE).map(({ channel, event }) => ({ channel, name: event, data: "{}" })),
        );
      }
    } catch (error) {
      console.error("[realtime] publish failed", error);
    }
  });
}

export const signal = {
  orderUpdated: (orderNumber: string): Signal => ({ channel: channels.order(orderNumber), event: events.orderUpdated }),
  chatChanged: (orderNumber: string): Signal => ({ channel: channels.order(orderNumber), event: events.chatChanged }),
  notification: (userId: string): Signal => ({ channel: channels.user(userId), event: events.notification }),
  poolChanged: (): Signal => ({ channel: channels.boosterPool, event: events.poolChanged }),
};
