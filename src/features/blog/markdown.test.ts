import { describe, expect, it } from "vitest";

import { parseBlocks, parseInline, plainText, readingMinutes, slugify } from "./markdown";

describe("blog markup", () => {
  it("parses headings, paragraphs and lists", () => {
    const blocks = parseBlocks("## Title\n\nFirst line\nsecond line\n\n- one\n- **two**\n\n### Small");
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "list", "heading"]);
    expect(blocks[1]).toEqual({ type: "paragraph", inlines: [{ type: "text", text: "First line second line" }] });
    expect(blocks[2]).toMatchObject({ type: "list", items: [[{ type: "text", text: "one" }], [{ type: "bold", text: "two" }]] });
    expect(blocks[3]).toMatchObject({ type: "heading", level: 3 });
  });

  it("keeps safe links and drops dangerous ones", () => {
    expect(parseInline("[a](https://x.test/p?q=1)")).toEqual([{ type: "link", text: "a", href: "https://x.test/p?q=1" }]);
    expect(parseInline("[b](/boost/valorant)")).toEqual([{ type: "link", text: "b", href: "/boost/valorant" }]);
    expect(parseInline("[c](javascript:alert(1))").some((inline) => inline.type === "link")).toBe(false);
    expect(parseInline("[d](data:text/html;base64,AAA)")).toEqual([{ type: "text", text: "d" }]);
    expect(parseInline("[e](//evil.test)")).toEqual([{ type: "text", text: "e" }]);
  });

  it("never produces raw HTML: tags stay plain text", () => {
    const blocks = parseBlocks('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
    expect(blocks).toEqual([{ type: "paragraph", inlines: [{ type: "text", text: '<script>alert(1)</script> and <img src=x onerror=alert(1)>' }] }]);
  });

  it("derives plain text, reading time and slugs", () => {
    expect(plainText("## Hi\n\n**bold** [link](https://x.test)")).toBe("Hi bold link");
    expect(readingMinutes("word ".repeat(450))).toBe(2);
    expect(readingMinutes("")).toBe(1);
    expect(slugify("Şampiyon Rehberi: Yükselme Yolları!")).toBe("sampiyon-rehberi-yukselme-yollari");
    expect(slugify("  --Hello   World--  ")).toBe("hello-world");
  });
});
