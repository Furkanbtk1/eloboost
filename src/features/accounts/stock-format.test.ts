import { describe, expect, it } from "vitest";

import { MAX_STOCK_LINES, parseStockLines } from "./stock-format";

describe("parseStockLines", () => {
  it("reads accounts with and without email access", () => {
    expect(parseStockLines("alpha pass1\r\n\nbeta pass2 b@x.test mailpass\n")).toEqual([
      { username: "alpha", password: "pass1" },
      { username: "beta", password: "pass2", email: "b@x.test", emailPassword: "mailpass" },
    ]);
  });

  it("rejects the whole batch when one line is malformed", () => {
    expect(parseStockLines("alpha pass1\nlonely")).toBeNull();
    expect(parseStockLines("a b c")).toBeNull();
    expect(parseStockLines("")).toBeNull();
    expect(parseStockLines("   \n  ")).toBeNull();
  });

  it("caps the batch size", () => {
    const many = Array.from({ length: MAX_STOCK_LINES + 1 }, (_, index) => `u${index} p`).join("\n");
    expect(parseStockLines(many)).toBeNull();
    expect(parseStockLines(many.split("\n").slice(0, MAX_STOCK_LINES).join("\n"))).toHaveLength(MAX_STOCK_LINES);
  });
});
