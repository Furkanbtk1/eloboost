import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { parseBlocks, type Inline } from "../markdown";

function renderInline(inline: Inline, key: number): ReactNode {
  switch (inline.type) {
    case "text":
      return inline.text;
    case "bold":
      return <strong key={key}>{inline.text}</strong>;
    case "link":
      return inline.href.startsWith("/") ? (
        <Link key={key} href={inline.href} className="font-medium text-primary underline-offset-4 hover:underline">
          {inline.text}
        </Link>
      ) : (
        <a
          key={key}
          href={inline.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {inline.text}
        </a>
      );
  }
}

const inlines = (list: Inline[]) => list.map(renderInline);

/** Renders post content from parsed data only: editor input never becomes HTML. */
export function PostBody({ content }: { content: string }) {
  return (
    <div className="grid gap-5 text-base leading-7 text-foreground/90">
      {parseBlocks(content).map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={index} className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                {inlines(block.inlines)}
              </h2>
            ) : (
              <h3 key={index} className="mt-2 text-xl font-semibold text-foreground">
                {inlines(block.inlines)}
              </h3>
            );
          case "list":
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-6">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inlines(item)}</li>
                ))}
              </ul>
            );
          case "paragraph":
            return <p key={index}>{inlines(block.inlines)}</p>;
        }
      })}
    </div>
  );
}
