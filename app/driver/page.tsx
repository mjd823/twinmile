import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { DriverDashboard } from "@/components/driver/driver-dashboard";

export const metadata: Metadata = {
  title: "Driver Portal",
  robots: { index: false, follow: false },
};

export default async function DriverPortalPage() {
  const user = await requireRole("driver");
  if (!user) {
    return null;
  }

  const name = `${String((user as any).firstName ?? "").trim()} ${String((user as any).lastName ?? "").trim()}`.trim();

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                Driver Portal
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {name ? name : user.email}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a className="hover:text-foreground" href="/driver/settings/profile">
                Profile
              </a>
              <span className="text-muted-foreground/60">·</span>
              <a className="hover:text-foreground" href="/driver/settings/password">
                Password
              </a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-6">
          <DriverDashboard />
        </div>
      </section>
    </main>
  );
}
