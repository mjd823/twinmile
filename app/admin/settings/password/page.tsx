import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export const metadata: Metadata = {
  title: "Change Password",
  robots: { index: false, follow: false },
};

export default async function AdminChangePasswordPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Change Password
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Signed in as {user.email}
              </div>
            </div>
            <a className="text-sm text-muted-foreground hover:text-foreground" href="/admin">
              ← Back to dashboard
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-2xl px-5 py-10">
          <div className="rounded-lg border border-border/60 bg-card p-6">
            <ChangePasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
