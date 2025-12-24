import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { DriverProfileForm } from "@/components/driver/driver-profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function DriverProfileSettingsPage() {
  const user = await requireRole("driver");
  if (!user) return null;

  const name = `${String((user as any).firstName ?? "").trim()} ${String((user as any).lastName ?? "").trim()}`.trim();

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Profile</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {name ? name : user.email}
              </div>
            </div>
            <a className="text-sm text-muted-foreground hover:text-foreground" href="/driver">
              ← Back to portal
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-2xl px-5 py-10">
          <div className="rounded-lg border border-border/60 bg-card p-6">
            <DriverProfileForm />
          </div>
        </div>
      </section>
    </main>
  );
}
