/** Chat attachments: screenshots only. */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
} as const;

export type AttachmentExtension = keyof typeof ATTACHMENT_TYPES;

export const ATTACHMENT_ACCEPT = Object.values(ATTACHMENT_TYPES).join(",");

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** Image type from the file's first bytes; the name and the browser-reported type are not trusted. */
export function sniffImage(bytes: Uint8Array): AttachmentExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

/** Storage key layout: orders/<order id>/<random id>.<extension> */
export function attachmentKey(orderId: string, fileId: string, extension: AttachmentExtension): string {
  return `orders/${orderId}/${fileId}.${extension}`;
}

/** Content type of a stored attachment, or null for keys this app did not write. */
export function attachmentContentType(key: string): string | null {
  const match = /^orders\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.exec(key);
  return match ? ATTACHMENT_TYPES[match[1] as AttachmentExtension] : null;
}
