import { describe, expect, it } from "vitest";

import { isValidIban, maskPayoutDetails, payoutAmountSchema, payoutDetailsSchema } from "@/features/payouts/details";
import { ADMIN_SECTIONS, findArea, roleCanAccess } from "@/lib/auth/access";

import { canOpenDispute, partialBoosterShareUsdCents, planResolution } from "./rules";

describe("disputes", () => {
  it("can only be opened while the order is being worked on", () => {
    expect(canOpenDispute("IN_PROGRESS")).toBe(true);
    expect(canOpenDispute("PAUSED")).toBe(true);
    expect(canOpenDispute("PENDING")).toBe(false);
    expect(canOpenDispute("COMPLETED")).toBe(false);
    expect(canOpenDispute("DISPUTED")).toBe(false);
  });

  it("maps each resolution to an order outcome", () => {
    expect(planResolution("REFUNDED", "IN_PROGRESS")).toMatchObject({ orderStatus: "CANCELLED", refund: "full", payBooster: false });
    expect(planResolution("PARTIAL_REFUND", "IN_PROGRESS")).toMatchObject({ orderStatus: "COMPLETED", refund: "partial", payBooster: true });
    expect(planResolution("REASSIGNED", "PAUSED")).toMatchObject({ orderStatus: "PENDING", releaseBooster: true, wipeCredentials: false });
    expect(planResolution("CONTINUED", "PAUSED")).toMatchObject({ orderStatus: "PAUSED", refund: "none" });
  });

  it("pays the booster pro rata after a partial refund", () => {
    // $100 order, $60 cut, $25 refunded -> 60 x 75% = $45
    expect(partialBoosterShareUsdCents({ totalCents: 10_000, boosterCutCents: 6_000, refundCents: 2_500, exchangeRate: 1 })).toBe(4_500);
    // ₺1,000 order at 0.03 USD/TRY, ₺600 cut, ₺500 refunded -> ₺300 -> $9.00
    expect(partialBoosterShareUsdCents({ totalCents: 100_000, boosterCutCents: 60_000, refundCents: 50_000, exchangeRate: 0.03 })).toBe(900);
    expect(() => partialBoosterShareUsdCents({ totalCents: 100, boosterCutCents: 60, refundCents: 100, exchangeRate: 1 })).toThrow();
    expect(() => partialBoosterShareUsdCents({ totalCents: 100, boosterCutCents: 60, refundCents: 0, exchangeRate: 1 })).toThrow();
  });
});

describe("payout details", () => {
  it("validates IBANs with the mod-97 check", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("TR33 0006 1005 1978 6457 8413 26")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("not an iban")).toBe(false);
  });

  it("normalizes and masks bank details", () => {
    const details = payoutDetailsSchema.parse({ method: "BANK_TRANSFER", accountHolder: "Vandal Queen", iban: "de89 3704 0044 0532 0130 00" });
    expect(details).toMatchObject({ iban: "DE89370400440532013000" });
    expect(maskPayoutDetails(details)).toBe("DE89 **** 3000");
  });

  it("checks crypto addresses and amounts", () => {
    expect(payoutDetailsSchema.safeParse({ method: "CRYPTO", network: "USDT_TRC20", address: "TQrZ8tKfjjB6Exampl3Wa11etAddr3ss00" }).success).toBe(true);
    expect(payoutDetailsSchema.safeParse({ method: "CRYPTO", network: "USDT_TRC20", address: "<script>" }).success).toBe(false);
    expect(payoutDetailsSchema.safeParse({ method: "CRYPTO", network: "DOGE", address: "TQrZ8tKfjjB6Exampl3Wa11etAddr3ss00" }).success).toBe(false);
    expect(payoutAmountSchema.safeParse(0.29).success).toBe(true);
    expect(payoutAmountSchema.safeParse(50.005).success).toBe(false);
    expect(payoutAmountSchema.safeParse(-5).success).toBe(false);
  });
});

describe("admin sections (RBAC)", () => {
  it("opens every admin section to ADMIN and none to anyone else", () => {
    for (const section of ADMIN_SECTIONS) {
      expect(roleCanAccess("ADMIN", `${section.prefix}/x`)).toBe(true);
      expect(roleCanAccess("BOOSTER", section.prefix)).toBe(false);
      expect(roleCanAccess("CUSTOMER", section.prefix)).toBe(false);
    }
    expect(roleCanAccess("ADMIN", "/admin")).toBe(true);
    expect(roleCanAccess("CUSTOMER", "/admin")).toBe(false);
  });

  it("requires 2FA on every admin section", () => {
    for (const section of ADMIN_SECTIONS) expect(findArea(`${section.prefix}/x`)?.requiresTwoFactor).toBe(true);
  });
});
