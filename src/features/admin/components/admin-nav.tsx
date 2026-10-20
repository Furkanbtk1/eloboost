import { getTranslations } from "next-intl/server";

import { ADMIN_SECTIONS, isStaffRole } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

import { AdminNavLinks } from "./admin-nav-links";

/** Sections the signed-in staff member may open. Reads the session: render inside <Suspense>. */
export async function AdminNav() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return null;
  const { role } = user;
  const t = await getTranslations("Admin.nav");

  const items = [
    { href: "/admin", label: t("overview") },
    ...ADMIN_SECTIONS.filter((section) => (section.roles as readonly string[]).includes(role)).map((section) => ({
      href: section.prefix,
      label: t(section.key),
    })),
  ];
  return <AdminNavLinks items={items} />;
}
