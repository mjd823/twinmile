import type { Metadata } from "next";

import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Driver Sign In",
  description: "Sign in to the Twin Mile LLC driver portal.",
  robots: { index: false, follow: false },
};

export default function DriverLoginPage() {
  return (
    <main>
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Driver Sign In
            </h1>
            <p className="mt-4 text-muted-foreground">
              Secure access for drivers and owner-operators.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-xl rounded-lg border border-border/60 bg-card p-6">
            <LoginForm role="driver" redirectTo="/driver" />
          </div>
        </div>
      </section>
    </main>
  );
}
