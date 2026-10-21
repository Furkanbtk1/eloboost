/**
 * Tiny, safe markup for blog posts. Posts are parsed into plain data and
 * rendered as React elements, so no HTML from the editor ever reaches the page.
 *
 * Supported: "## " and "### " headings, "- " lists, blank-line paragraphs,
 * **bold**, and [text](url) links (http, https, mailto or site-relative only).
 */

export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: 2 | 3; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; items: Inline[][] };

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

export function parseInline(source: string): Inline[] {
  const inlines: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) inlines.push({ type: "text", text: source.slice(last, match.index) });
    if (match[1] !== undefined) {
      inlines.push({ type: "bold", text: match[1] });
    } else if (SAFE_HREF.test(match[3])) {
      inlines.push({ type: "link", text: match[2], href: match[3] });
    } else {
      // Unsafe scheme (javascript:, data:...): keep the words, drop the link.
      inlines.push({ type: "text", text: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) inlines.push({ type: "text", text: source.slice(last) });
  return inlines;
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    if (list.length) blocks.push({ type: "list", items: list });
    paragraph = [];
    list = [];
  };

  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length === 2 ? 2 : 3, inlines: parseInline(heading[2]) });
    } else if (item) {
      if (paragraph.length) flush();
      list.push(parseInline(item[1]));
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Plain text of a post, for meta descriptions and reading time. */
export function plainText(content: string): string {
  return content
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(content: string): number {
  const words = plainText(content).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
