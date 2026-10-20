import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Twitch from "next-auth/providers/twitch";
import { z } from "zod";

import { LOGIN_PATH } from "@/lib/auth/access";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { openTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { peekRateLimit, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/request";

// ---------------------------------------------------------------------------
// Credential sign-in errors. `code` reaches the login action, never the URL.
// ---------------------------------------------------------------------------

export const SIGN_IN_ERROR = {
  invalidCredentials: "invalid_credentials",
  twoFactorRequired: "two_factor_required",
  invalidTwoFactorCode: "invalid_two_factor_code",
  accountBanned: "account_banned",
  rateLimited: "rate_limited",
} as const;

/**
 * Thrown before any password check once a caller exceeds the login limits.
 * Lives in `authorize` (not only the login action) because Auth.js also
 * exposes /api/auth/callback/credentials directly.
 */
export class SignInRateLimited extends CredentialsSignin {
  code = SIGN_IN_ERROR.rateLimited;
  constructor(readonly retryAfterSeconds: number) {
    super();
  }
}

class InvalidCredentials extends CredentialsSignin {
  code = SIGN_IN_ERROR.invalidCredentials;
}
class TwoFactorRequired extends CredentialsSignin {
  code = SIGN_IN_ERROR.twoFactorRequired;
}
class InvalidTwoFactorCode extends CredentialsSignin {
  code = SIGN_IN_ERROR.invalidTwoFactorCode;
}
class AccountBanned extends CredentialsSignin {
  code = SIGN_IN_ERROR.accountBanned;
}

/**
 * Compared against when the email is unknown, so a missing account takes as
 * long to reject as a wrong password and response times don't leak emails.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$9XgAiV9vy0fta2rzjRRsSejuE6DhS8yRScqN7lYKOkhj8NLiHpiDC";

const credentialsInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
  code: z.string().trim().optional(),
});

/** Re-read the user at most this often, so bans and role changes apply quickly. */
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export type OAuthProviderId = "discord" | "google" | "twitch";

const oauthProviders = [
  env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET
    ? { id: "discord" as const, provider: Discord({ clientId: env.AUTH_DISCORD_ID, clientSecret: env.AUTH_DISCORD_SECRET }) }
    : null,
  env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
    ? { id: "google" as const, provider: Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }) }
    : null,
  env.AUTH_TWITCH_ID && env.AUTH_TWITCH_SECRET
    ? { id: "twitch" as const, provider: Twitch({ clientId: env.AUTH_TWITCH_ID, clientSecret: env.AUTH_TWITCH_SECRET }) }
    : null,
].filter((entry) => entry !== null);

/** OAuth providers with credentials configured; the login page shows only these. */
export const enabledOAuthProviders: OAuthProviderId[] = oauthProviders.map((entry) => entry.id);

/** Accounts are linked by email, so the provider must have verified it. */
function hasVerifiedEmail(provider: string, profile: Record<string, unknown> | undefined): boolean {
  if (provider === "google") return profile?.email_verified === true;
  if (provider === "discord") return profile?.verified === true;
  // Twitch only shares the email of accounts that verified it.
  if (provider === "twitch") return profile?.email_verified !== false;
  return false;
}

/** Path the login page reads to show why an OAuth attempt was refused. */
const oauthError = (code: string) => `${LOGIN_PATH}?error=${code}`;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function refreshToken(token: JWT): Promise<JWT | null> {
  if (!token.sub) return null;

  const user = await db.user.findUnique({
    where: { id: token.sub },
    select: { email: true, name: true, avatarUrl: true, role: true, isBanned: true, is2FAEnabled: true },
  });
  if (!user || user.isBanned) return null; // clears the session cookie

  return {
    ...token,
    email: user.email,
    name: user.name,
    picture: user.avatarUrl,
    role: user.role,
    needsTwoFactorSetup: needsTwoFactorSetup(user.role, user.is2FAEnabled),
    refreshedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------

const config = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: LOGIN_PATH, error: LOGIN_PATH },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw, request) {
        const parsed = credentialsInput.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const { email, password, code } = parsed.data;

        // Limits count failed attempts only, so shared IPs (offices, campuses)
        // aren't locked out by legitimate sign-ins.
        const ip = clientIpFrom(request.headers);
        const accountKey = `${ip}:${email}`;
        const limits = await Promise.all([peekRateLimit("loginIp", ip), peekRateLimit("login", accountKey)]);
        for (const limit of limits) {
          if (!limit.success) throw new SignInRateLimited(limit.retryAfterSeconds);
        }
        const failed = async (error: CredentialsSignin) => {
          await Promise.all([rateLimit("loginIp", ip), rateLimit("login", accountKey)]);
          return error;
        };

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            passwordHash: true,
            isBanned: true,
            is2FAEnabled: true,
            twoFactorSecret: true,
          },
        });

        const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user?.passwordHash || !passwordOk) throw await failed(new InvalidCredentials());
        if (user.isBanned) throw new AccountBanned();

        if (user.is2FAEnabled) {
          // Correct password, second step pending: not a failure.
          if (!code) throw new TwoFactorRequired();
          const secret = user.twoFactorSecret ? openTotpSecret(user.twoFactorSecret, user.id) : null;
          if (!secret || !verifyTotp(secret, code)) throw await failed(new InvalidTwoFactorCode());
        }

        await Promise.all([
          resetRateLimit("login", accountKey),
          db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        ]);
        return { id: user.id, email: user.email, name: user.name, image: user.avatarUrl };
      },
    }),
    ...oauthProviders.map((entry) => entry.provider),
  ],
  callbacks: {
    /** Links or creates the local user for OAuth sign-ins. */
    async signIn({ account, profile, user }) {
      if (!account || account.type === "credentials") return true;

      const email = user.email?.toLowerCase();
      if (!email || !hasVerifiedEmail(account.provider, profile)) return oauthError("OAuthEmailUnverified");

      const linked = await db.account.findUnique({
        where: {
          provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId },
        },
        select: { user: { select: { id: true, role: true, isBanned: true, is2FAEnabled: true } } },
      });
      let dbUser = linked?.user ?? null;
      if (!dbUser) {
        const byEmail = await db.user.findUnique({
          where: { email },
          select: { id: true, role: true, isBanned: true, is2FAEnabled: true, emailVerified: true },
        });
        // Linking to an account whose email was never verified would let whoever
        // registered that address first take over the real owner's sign-in.
        if (byEmail && !byEmail.emailVerified) return oauthError("OAuthAccountNotLinked");
        dbUser = byEmail;
      }

      if (dbUser?.isBanned) return oauthError("AccountBanned");
      // OAuth skips the 2FA step, so it is only allowed for customers without 2FA.
      if (dbUser && dbUser.role !== "CUSTOMER") return oauthError("OAuthStaff");
      if (dbUser?.is2FAEnabled) return oauthError("OAuthTwoFactor");

      dbUser ??= await db.user.create({
        data: { email, name: user.name, avatarUrl: user.image, emailVerified: new Date() },
        select: { id: true, role: true, isBanned: true, is2FAEnabled: true },
      });

      if (!linked) {
        await db.account.create({
          data: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
      }

      await db.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Fresh sign-in: point the token at our user id, not the provider's.
      if (account && user) {
        if (account.type === "credentials") {
          token.sub = user.id;
        } else {
          const linked = await db.account.findUnique({
            where: {
              provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId },
            },
            select: { userId: true },
          });
          token.sub = linked?.userId;
        }
        return refreshToken(token);
      }

      if (trigger === "update" || Date.now() - (token.refreshedAt ?? 0) > TOKEN_REFRESH_MS) {
        return refreshToken(token);
      }
      return token;
    },

    session({ session, token }) {
      if (token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.needsTwoFactorSetup = token.needsTwoFactorSetup ?? false;
      }
      return session;
    },
  },
  logger: {
    // Wrong passwords are expected traffic, not server errors.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(config);
