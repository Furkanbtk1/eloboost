import { describe, expect, it } from "vitest";

import { attachmentContentType, attachmentKey, sniffImage } from "./attachments";
import { moderate } from "./moderation";
import { canWatchPool, chatClosedReason, chatRole, type ChatViewer } from "./rules";

const ORDER_ID = "0199f2a4-7c1e-7d3a-9b2f-3c4d5e6f7a8b";
const FILE_ID = "0199f2a4-7c1e-7d3a-9b2f-aaaaaaaaaaaa";

describe("moderate", () => {
  it("masks profanity and flags the message", () => {
    expect(moderate("you are a fucking idiot")).toEqual({ text: "you are a ******* idiot", flagged: true });
    expect(moderate("Siktir git")).toEqual({ text: "****** git", flagged: true });
    expect(moderate("SİKTİR")).toEqual({ text: "******", flagged: true });
    expect(moderate("amk").flagged).toBe(true);
    expect(moderate("du Hurensohn").text).toBe("du *********");
    expect(moderate("eres un gilipollas").text).toBe("eres un **********");
  });

  it("sees through leetspeak and stretched letters", () => {
    expect(moderate("b1tch").flagged).toBe(true);
    expect(moderate("fuuuuuck").flagged).toBe(true);
    expect(moderate("amkkkkk").flagged).toBe(true);
    expect(moderate("şerefsiz").flagged).toBe(true);
    expect(moderate("serefsiz").flagged).toBe(true);
  });

  it("leaves normal words alone", () => {
    for (const text of [
      "Scunthorpe classic assassin",
      "sık sık oynarız, sıkıntı yok",
      "Niger and Nigeria",
      "send me a pic of the OC",
      "Amina got it, consult the shiitake recipe",
      "Diamond III reached, 7W-1L so far.",
      "Ananas yedim",
    ]) {
      expect(moderate(text)).toEqual({ text, flagged: false });
    }
  });
});

describe("sniffImage", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it("detects png, jpeg and webp from magic bytes", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("rejects anything else, whatever its name", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull(); // GIF
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("attachment keys", () => {
  it("round-trips the content type of keys the app writes", () => {
    expect(attachmentContentType(attachmentKey(ORDER_ID, FILE_ID, "webp"))).toBe("image/webp");
  });

  it("rejects foreign or traversal keys", () => {
    expect(attachmentContentType("/uploads/seed/afk-proof.png")).toBeNull();
    expect(attachmentContentType(`orders/${ORDER_ID}/../secret.png`)).toBeNull();
    expect(attachmentContentType(`orders/${ORDER_ID}/${FILE_ID}.svg`)).toBeNull();
  });
});

describe("chat access", () => {
  const order = { customerId: "customer", boosterId: "booster", status: "IN_PROGRESS" as const };
  const viewer = (overrides: Partial<ChatViewer>): ChatViewer => ({
    id: "someone",
    role: "CUSTOMER",
    boosterStatus: null,
    twoFactorReady: true,
    ...overrides,
  });

  it("lets the order's customer and current booster in", () => {
    expect(chatRole(viewer({ id: "customer" }), order)).toBe("customer");
    expect(chatRole(viewer({ id: "booster", role: "BOOSTER", boosterStatus: "ACTIVE" }), order)).toBe("booster");
  });

  it("keeps everyone else out", () => {
    expect(chatRole(viewer({ id: "other" }), order)).toBeNull();
    expect(chatRole(viewer({ id: "other", role: "BOOSTER", boosterStatus: "ACTIVE" }), order)).toBeNull();
    expect(chatRole(viewer({ id: "booster", role: "BOOSTER", boosterStatus: "SUSPENDED" }), order)).toBeNull();
    expect(chatRole(viewer({ id: "booster", role: "BOOSTER", boosterStatus: "ACTIVE", twoFactorReady: false }), order)).toBeNull();
    expect(chatRole(viewer({ role: "FINANCE" }), order)).toBeNull();
  });

  it("gives support staff read-only access", () => {
    expect(chatRole(viewer({ role: "SUPPORT" }), order)).toBe("staff");
    expect(chatClosedReason("staff", order)).toBe("readOnly");
    expect(chatRole(viewer({ role: "ADMIN", twoFactorReady: false }), order)).toBeNull();
  });

  it("opens writing only while a booster works on the order", () => {
    expect(chatClosedReason("customer", order)).toBeNull();
    expect(chatClosedReason("customer", { ...order, status: "DISPUTED" })).toBeNull();
    expect(chatClosedReason("customer", { ...order, boosterId: null, status: "PENDING" })).toBe("waitingForBooster");
    expect(chatClosedReason("booster", { ...order, status: "COMPLETED" })).toBe("closed");
  });

  it("shows the pool only to approved boosters with 2FA", () => {
    expect(canWatchPool(viewer({ role: "BOOSTER", boosterStatus: "ACTIVE" }))).toBe(true);
    expect(canWatchPool(viewer({ role: "BOOSTER", boosterStatus: "PENDING_APPROVAL" }))).toBe(false);
    expect(canWatchPool(viewer({ role: "CUSTOMER" }))).toBe(false);
  });
});
