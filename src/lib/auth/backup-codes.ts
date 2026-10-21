import "server-only";

import { db } from "@/lib/db";

import { BACKUP_CODE_COUNT, hashBackupCode, newBackupCode } from "./secrets";

/** Replaces all recovery codes with a fresh set; the plain codes are returned once and never stored. */
export async function issueBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, newBackupCode);
  await db.$transaction([
    db.twoFactorBackupCode.deleteMany({ where: { userId } }),
    db.twoFactorBackupCode.createMany({ data: codes.map((code) => ({ userId, codeHash: hashBackupCode(code) })) }),
  ]);
  return codes;
}

/** Spends a code. Conditional update, so two parallel sign-ins can't both use it. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const { count } = await db.twoFactorBackupCode.updateMany({
    where: { userId, codeHash: hashBackupCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

export function countUnusedBackupCodes(userId: string): Promise<number> {
  return db.twoFactorBackupCode.count({ where: { userId, usedAt: null } });
}
