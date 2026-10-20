import { describe, expect, it } from "vitest";

import { allowedTransitions, canBoosterTake, stepIndex, type EligibilityOrder } from "./workflow";

// LoL ladder positions: Gold IV 12, Platinum IV 16, Diamond IV 24, Diamond I 27, Master 28, Challenger 30.
const division = (start: number, desired: number): EligibilityOrder => ({
  orderType: "DIVISION",
  rankSystem: "DIVISION",
  startRank: { position: start },
  desiredRank: { position: desired },
  maxPosition: 30,
});

describe("canBoosterTake", () => {
  it("requires a rank above the order's desired rank", () => {
    expect(canBoosterTake({ position: 28 }, division(24, 27))).toBe(true); // Master takes Diamond IV -> I
    expect(canBoosterTake({ position: 27 }, division(24, 27))).toBe(false); // Diamond I can't
    expect(canBoosterTake({ position: 17 }, division(12, 16))).toBe(true);
    expect(canBoosterTake({ position: 16 }, division(12, 16))).toBe(false);
  });

  it("lets top-of-ladder boosters take orders to the top", () => {
    expect(canBoosterTake({ position: 30 }, division(28, 30))).toBe(true);
    expect(canBoosterTake({ position: 29 }, division(28, 30))).toBe(false);
  });

  it("checks wins and placements against the starting rank", () => {
    const wins: EligibilityOrder = { ...division(27, 27), orderType: "WIN" };
    expect(canBoosterTake({ position: 28 }, wins)).toBe(true);
    expect(canBoosterTake({ position: 27 }, wins)).toBe(false);
  });

  it("compares ratings on rating games", () => {
    const cs2: EligibilityOrder = {
      orderType: "DIVISION",
      rankSystem: "RATING",
      startRank: { rating: 9000 },
      desiredRank: { rating: 12000 },
      maxPosition: 0,
    };
    expect(canBoosterTake({ rating: 28500 }, cs2)).toBe(true);
    expect(canBoosterTake({ rating: 12000 }, cs2)).toBe(false);
  });

  it("needs a rank in the game, even for coaching", () => {
    const coaching: EligibilityOrder = { ...division(0, 0), orderType: "COACHING", startRank: {}, desiredRank: {} };
    expect(canBoosterTake({ position: 5 }, coaching)).toBe(true);
    expect(canBoosterTake(undefined, coaching)).toBe(false);
    expect(canBoosterTake({}, division(12, 16))).toBe(false);
  });
});

describe("status changes", () => {
  it("offers only the moves valid from each status", () => {
    expect(allowedTransitions("ASSIGNED")).toEqual(["start", "release"]);
    expect(allowedTransitions("IN_PROGRESS")).toEqual(["pause", "complete"]);
    expect(allowedTransitions("PAUSED")).toEqual(["resume"]);
    expect(allowedTransitions("COMPLETED")).toEqual([]);
    expect(allowedTransitions("PENDING")).toEqual([]);
  });

  it("maps statuses onto the customer's stepper", () => {
    expect(stepIndex("AWAITING_PAYMENT")).toBe(-1);
    expect(stepIndex("PENDING")).toBe(0);
    expect(stepIndex("PAUSED")).toBe(2);
    expect(stepIndex("COMPLETED")).toBe(3);
  });
});
