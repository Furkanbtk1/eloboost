import { NextResponse } from "next/server";

import { findChatOrder, getChatViewer } from "@/features/chat/access";
import { canWatchPool } from "@/features/chat/rules";
import { parseChannel } from "@/lib/realtime/channels";
import { pusher } from "@/lib/realtime/server";

const deny = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

/** Same-origin only, so another site can't obtain channel signatures with the user's cookies. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return URL.canParse(origin) && new URL(origin).host === host;
}

/**
 * Pusher private-channel authorization. Each channel maps to a rule:
 * own user channel, an order whose chat the user may read, or the booster pool.
 */
export async function POST(request: Request) {
  if (!pusher) return NextResponse.json({ error: "Realtime is not configured" }, { status: 404 });
  if (!isSameOrigin(request)) return deny();

  const form = await request.formData();
  const socketId = form.get("socket_id");
  const channelName = form.get("channel_name");
  if (typeof socketId !== "string" || !/^\d+\.\d+$/.test(socketId) || typeof channelName !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const channel = parseChannel(channelName);
  const viewer = await getChatViewer();
  if (!channel || !viewer) return deny();

  const allowed =
    channel.kind === "user"
      ? channel.userId === viewer.id
      : channel.kind === "order"
        ? (await findChatOrder(viewer, { orderNumber: channel.orderNumber })) !== null
        : canWatchPool(viewer);
  if (!allowed) return deny();

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
}
