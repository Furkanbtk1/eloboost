import type { UserRole } from "@/generated/prisma/enums";

/**
 * Route-level access rules shared by the proxy (optimistic check on every
 * request) and server pages (authoritative check against the database).
 * Paths are locale-free, e.g. "/admin/payouts".
 */

export const STAFF_ROLES = ["ADMIN"] as const satisfies readonly UserRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}

/** Roles that must have 2FA enabled when REQUIRE_STAFF_2FA is on. */
export const TWO_FACTOR_REQUIRED_ROLES: readonly UserRole[] = [...STAFF_ROLES, "BOOSTER"];

type AreaRule = { prefix: string; roles: readonly UserRole[]; requiresTwoFactor: boolean };

/** Admin panel sections. ADMIN covers support, disputes and finance, so each is open to ADMIN only. */
export const ADMIN_SECTIONS = [
  { key: "orders", prefix: "/admin/orders", roles: ["ADMIN"] },
  { key: "disputes", prefix: "/admin/disputes", roles: ["ADMIN"] },
  { key: "users", prefix: "/admin/users", roles: ["ADMIN"] },
  { key: "payouts", prefix: "/admin/payouts", roles: ["ADMIN"] },
  { key: "pricing", prefix: "/admin/pricing", roles: ["ADMIN"] },
  { key: "promos", prefix: "/admin/promos", roles: ["ADMIN"] },
  { key: "reviews", prefix: "/admin/reviews", roles: ["ADMIN"] },
  { key: "accounts", prefix: "/admin/accounts", roles: ["ADMIN"] },
  { key: "blog", prefix: "/admin/blog", roles: ["ADMIN"] },
  { key: "audit", prefix: "/admin/audit", roles: ["ADMIN"] },
] as const satisfies readonly { key: string; prefix: string; roles: readonly StaffRole[] }[];

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]["key"];

/** The first matching prefix wins, so specific sections come before their parents. */
const AREAS: readonly AreaRule[] = [
  ...ADMIN_SECTIONS.map(({ prefix, roles }) => ({ prefix, roles, requiresTwoFactor: true })),
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

/** Role check only (sign-in and 2FA are checked separately). */
export function roleCanAccess(role: UserRole, pathname: string): boolean {
  const area = findArea(pathname);
  return !area || area.roles.includes(role);
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
