import { describe, expect, it } from "vitest";

import { isTipPercent, publicReviewerName, tipCents } from "./rules";

describe("tips", () => {
  it("offers only 5, 10 and 20 percent", () => {
    expect([5, 10, 20].every(isTipPercent)).toBe(true);
    expect(isTipPercent(15)).toBe(false);
    expect(isTipPercent("10")).toBe(false);
  });

  it("computes the tip in cents of the order currency", () => {
    expect(tipCents(5280, 10)).toBe(528);
    expect(tipCents(12345, 5)).toBe(617); // 617.25 -> 617
    expect(tipCents(99, 20)).toBe(20); // 19.8 -> 20
  });
});

describe("public reviewer names", () => {
  it("shows a first name and an initial only", () => {
    expect(publicReviewerName("Alex Carter")).toBe("Alex C.");
    expect(publicReviewerName("  elif  yılmaz demir ")).toBe("elif D.");
    expect(publicReviewerName("Elif")).toBe("Elif");
  });

  it("hides missing names and emails", () => {
    expect(publicReviewerName(null)).toBeNull();
    expect(publicReviewerName("   ")).toBeNull();
    expect(publicReviewerName("someone@example.com")).toBeNull();
  });
});
