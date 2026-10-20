"use client";

import { LayoutDashboardIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/generated/prisma/enums";
import { getPathname, Link } from "@/i18n/navigation";
import { TWO_FACTOR_SETUP_PATH } from "@/lib/auth/access";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UserMenu({
  name,
  email,
  role,
  panelHref,
}: {
  name: string;
  email: string;
  role: UserRole;
  panelHref: string;
}) {
  const t = useTranslations("Header");
  const tRole = useTranslations("Roles");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("account")} className="gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
            {initials(name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-1 font-normal">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
          <Badge variant="secondary" className="mt-1">
            {tRole(role)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={panelHref}>
            <LayoutDashboardIcon />
            {t("myPanel")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={TWO_FACTOR_SETUP_PATH}>
            <ShieldIcon />
            {t("security")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          // Posts to /api/auth/signout, which the proxy skips, so no refreshed
          // session cookie can race with the deletion.
          onSelect={() => startTransition(() => signOut({ redirectTo: getPathname({ href: "/", locale }) }))}
        >
          <LogOutIcon />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
