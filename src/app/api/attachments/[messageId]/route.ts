import { findChatOrder, getChatViewer } from "@/features/chat/access";
import { attachmentContentType } from "@/features/chat/attachments";
import { db } from "@/lib/db";
import { getObjectStream } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Streams a chat screenshot from the private bucket to someone who may read
 * that order's chat. Served as an inert image: no sniffing, no scripts.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[messageId]">) {
  const { messageId } = await params;
  if (!UUID.test(messageId)) return notFound();

  const viewer = await getChatViewer();
  if (!viewer) return notFound();

  const message = await db.message.findUnique({ where: { id: messageId }, select: { orderId: true, attachmentKey: true } });
  const contentType = message?.attachmentKey ? attachmentContentType(message.attachmentKey) : null;
  if (!message?.attachmentKey || !contentType) return notFound();
  if (!(await findChatOrder(viewer, { id: message.orderId }))) return notFound();

  const body = await getObjectStream(message.attachmentKey);
  if (!body) return notFound();

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
