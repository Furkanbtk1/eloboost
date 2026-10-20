import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** Staff/booster account that still has to enable 2FA. */
      needsTwoFactorSetup: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    needsTwoFactorSetup?: boolean;
    /** Epoch ms of the last database refresh of role / ban status. */
    refreshedAt?: number;
  }
}
