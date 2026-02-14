import Link from "next/link";

import { getAuthUser } from "@/lib/auth/session";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  const isAdmin = Boolean(user && user.role === "admin");

  if (!isAdmin) {
    return <div className="mx-auto w-full max-w-7xl px-5 py-6">{children}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6">
      <AdminMobileNav />

      <div className="flex gap-6">
        <AdminSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
