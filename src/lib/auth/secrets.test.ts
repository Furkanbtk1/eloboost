import { describe, expect, it } from "vitest";

import { BACKUP_CODE_COUNT, hashBackupCode, hashSecret, looksLikeBackupCode, newBackupCode, newEmailToken, normalizeBackupCode } from "./secrets";

describe("backup codes", () => {
  it("generates unambiguous, well-formed codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = newBackupCode();
      expect(code).toMatch(/^[2-9a-hj-km-np-z]{5}-[2-9a-hj-km-np-z]{5}$/);
      expect(looksLikeBackupCode(code)).toBe(true);
    }
    expect(BACKUP_CODE_COUNT).toBe(8);
  });

  it("ignores case, spaces and the dash when matching", () => {
    expect(hashBackupCode("K3M9X-Q7W2A")).toBe(hashBackupCode("k3m9x q7w2a"));
    expect(hashBackupCode("k3m9xq7w2a")).toBe(hashBackupCode("k3m9x-q7w2a"));
    expect(normalizeBackupCode(" K3M9X-Q7W2A ")).toBe("k3m9xq7w2a");
  });

  it("tells backup codes from TOTP codes", () => {
    expect(looksLikeBackupCode("123456")).toBe(false);
    expect(looksLikeBackupCode("12345-67890")).toBe(true);
    expect(looksLikeBackupCode("abc")).toBe(false);
  });
});

describe("email tokens", () => {
  it("are long, unique and hashed deterministically", () => {
    const a = newEmailToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(newEmailToken());
    expect(hashSecret(a)).toBe(hashSecret(a));
    expect(hashSecret(a)).not.toContain(a);
  });
});
