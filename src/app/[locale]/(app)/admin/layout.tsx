import { Suspense, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AdminNav } from "@/features/admin/components/admin-nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-8">
      <Suspense fallback={<Skeleton className="h-10 w-full max-w-3xl rounded-lg" />}>
        <AdminNav />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
