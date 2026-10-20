/**
 * Channel and event names shared by the server (publishing, channel auth) and
 * the browser (subscribing). Events only signal that something changed; the
 * browser then reloads the data through a server action, so chat content and
 * personal data never travel through Pusher.
 */

export const channels = {
  order: (orderNumber: string) => `private-order-${orderNumber}`,
  user: (userId: string) => `private-user-${userId}`,
  boosterPool: "private-booster-pool",
} as const;

export const events = {
  /** Status, progress, credentials or access log changed. */
  orderUpdated: "order-updated",
  /** A chat message was sent, or messages were read. */
  chatChanged: "chat-changed",
  notification: "notification",
  poolChanged: "pool-changed",
} as const;

export type RealtimeEvent = (typeof events)[keyof typeof events];

export type ParsedChannel =
  | { kind: "order"; orderNumber: string }
  | { kind: "user"; userId: string }
  | { kind: "boosterPool" };

const ORDER_PREFIX = "private-order-";
const USER_PREFIX = "private-user-";

export function parseChannel(name: string): ParsedChannel | null {
  if (name === channels.boosterPool) return { kind: "boosterPool" };
  if (name.startsWith(ORDER_PREFIX)) {
    const orderNumber = name.slice(ORDER_PREFIX.length);
    return /^[A-Z]+-\d+$/.test(orderNumber) ? { kind: "order", orderNumber } : null;
  }
  if (name.startsWith(USER_PREFIX)) {
    const userId = name.slice(USER_PREFIX.length);
    return /^[0-9a-f-]{36}$/.test(userId) ? { kind: "user", userId } : null;
  }
  return null;
}

/** What the browser needs to connect; null when realtime is not configured. */
export type RealtimeClientConfig = {
  key: string;
  cluster: string;
  host?: string;
  port?: number;
  tls: boolean;
};
