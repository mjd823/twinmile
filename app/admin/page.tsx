import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { AdminOpsDashboard } from "@/components/admin/admin-ops-dashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const user = await requireRole("admin");
  if (!user) {
    return null;
  }

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Operations
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Signed in as {user.email}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Truck Manager-style ops view (Phase A)
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AdminOpsDashboard />
        </div>
      </section>
    </main>
  );
}
