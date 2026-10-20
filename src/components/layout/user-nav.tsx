import { getTranslations } from "next-intl/server";

import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { countUnreadNotifications } from "@/features/notifications/queries";
import { Link } from "@/i18n/navigation";
import { homePathForRole } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Header auth area. Reads the session cookie, so render it inside <Suspense>.
 * Uses the database-backed user so bans and role changes show up immediately.
 */
export async function UserNav() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("Header")]);

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">{t("signUp")}</Link>
        </Button>
      </div>
    );
  }

  const unread = await countUnreadNotifications(user.id);
  return (
    <div className="flex items-center gap-1">
      <NotificationBell userId={user.id} initialUnread={unread} />
      <UserMenu
        name={user.name ?? user.email}
        email={user.email}
        role={user.role}
        panelHref={homePathForRole(user.role)}
      />
    </div>
  );
}
