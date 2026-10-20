import type { UserRole } from "@/generated/prisma/enums";

/**
 * Route-level access rules shared by the proxy (optimistic check on every
 * request) and server pages (authoritative check against the database).
 * Paths are locale-free, e.g. "/admin/payouts".
 */

export const STAFF_ROLES = ["ADMIN", "SUPPORT", "FINANCE"] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}

/** Roles that must have 2FA enabled when REQUIRE_STAFF_2FA is on. */
export const TWO_FACTOR_REQUIRED_ROLES: readonly UserRole[] = [...STAFF_ROLES, "BOOSTER"];

type AreaRule = { prefix: string; roles: readonly UserRole[]; requiresTwoFactor: boolean };

const AREAS: readonly AreaRule[] = [
  { prefix: "/admin", roles: STAFF_ROLES, requiresTwoFactor: true },
  { prefix: "/booster", roles: ["BOOSTER"], requiresTwoFactor: true },
  { prefix: "/dashboard", roles: ["CUSTOMER"], requiresTwoFactor: false },
  { prefix: "/checkout", roles: ["CUSTOMER"], requiresTwoFactor: false },
  { prefix: "/account", roles: ["CUSTOMER", "BOOSTER", ...STAFF_ROLES], requiresTwoFactor: false },
];

/** Pages only meant for signed-out visitors. */
export const AUTH_PAGES = ["/login", "/register"] as const;

export const LOGIN_PATH = "/login";
export const TWO_FACTOR_SETUP_PATH = "/account/security";

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function findArea(pathname: string): AreaRule | undefined {
  return AREAS.find((area) => matches(pathname, area.prefix));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => matches(pathname, page));
}

/** Where each role lands after signing in or when it opens an area it can't use. */
export function homePathForRole(role: UserRole): string {
  if (role === "BOOSTER") return "/booster";
  if (role === "CUSTOMER") return "/dashboard";
  return "/admin";
}

/**
 * Accepts only same-site relative paths, so `callbackUrl` can't be used as an
 * open redirect (e.g. "//evil.com" or "https://evil.com").
 */
export function safeCallbackPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
