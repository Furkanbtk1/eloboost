import "server-only";

import type { UserRole } from "@/generated/prisma/enums";
import { TWO_FACTOR_REQUIRED_ROLES } from "@/lib/auth/access";
import { env } from "@/lib/env";

export function isTwoFactorMandatory(role: UserRole): boolean {
  return env.REQUIRE_STAFF_2FA && TWO_FACTOR_REQUIRED_ROLES.includes(role);
}

/** True when the account must finish 2FA setup before entering its panel. */
export function needsTwoFactorSetup(role: UserRole, is2FAEnabled: boolean): boolean {
  return isTwoFactorMandatory(role) && !is2FAEnabled;
}
