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
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <a
                className="inline-flex h-9 items-center rounded-md border border-border/60 bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                href="/driver/settings/profile"
              >
                Profile
              </a>
              <a
                className="inline-flex h-9 items-center rounded-md border border-border/60 bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                href="/driver/settings/password"
              >
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
