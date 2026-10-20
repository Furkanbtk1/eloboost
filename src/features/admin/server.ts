import "server-only";

import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import type { Prisma } from "@/generated/prisma/client";
import { routing } from "@/i18n/routing";
import { isStaffRole, roleCanAccess, type StaffRole } from "@/lib/auth/access";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { clientIpFrom } from "@/lib/request";

export type StaffActor = { id: string; role: StaffRole; name: string };

/**
 * For admin server actions, which can be called without opening the page:
 * signed-in staff whose role may use the section at `path`, with 2FA in place.
 */
export async function getStaffActor(path: string): Promise<StaffActor | null> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role) || !roleCanAccess(user.role, path)) return null;
  if (needsTwoFactorSetup(user.role, user.is2FAEnabled)) return null;
  return { id: user.id, role: user.role, name: user.name ?? user.email };
}

/** Error messages for admin actions in the caller's language. */
export function adminErrors(rawLocale: string) {
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  return getTranslations({ locale, namespace: "Admin.errors" });
}

type AuditEntry = {
  adminId: string;
  /** Dotted verb, e.g. "payout.approve". */
  action: string;
  targetType: string;
  targetId: string;
  details?: Prisma.InputJsonValue;
};

/** Every admin mutation leaves one row; pass the transaction client so it commits with the change. */
export async function writeAudit(client: Prisma.TransactionClient | typeof db, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: { ...entry, ipAddress: clientIpFrom(await headers()) },
  });
}
