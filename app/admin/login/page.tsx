import type { Metadata } from "next";

import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Admin Sign In",
  description: "Sign in to the Twin Mile LLC admin dashboard.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Admin Sign In
            </h1>
            <p className="mt-4 text-muted-foreground">
              Secure access for operations and lead management.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="mx-auto max-w-xl rounded-lg border border-border/60 bg-card p-6">
            <LoginForm role="admin" redirectTo="/admin" />
          </div>
        </div>
      </section>
    </main>
  );
}
