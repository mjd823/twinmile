import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Driver Portal",
  robots: { index: false, follow: false },
};

export default async function DriverPortalPage() {
  const user = await requireRole("driver");
  if (!user) {
    return null;
  }

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Driver Portal
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Signed in as {user.email}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/driver/settings/password"
              >
                Change password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="text-sm text-muted-foreground hover:text-foreground"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="rounded-lg border border-border/60 bg-card p-6">
            <div className="text-lg font-semibold tracking-tight">Coming soon</div>
            <div className="mt-2 text-sm text-muted-foreground">
              This portal will house load details, documents, and driver tools.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
