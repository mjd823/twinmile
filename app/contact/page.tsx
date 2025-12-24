import type { Metadata } from "next";

import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Twin Mile LLC for freight quotes, dispatching, last-mile delivery, hotshot trucking, warehousing, and 3PL nationwide.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-44 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Quotes • Dispatch • Driver opportunities
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Contact</h1>
            <p className="mt-4 text-muted-foreground">
              Reach out to schedule a pickup, request a quote, or learn about driver opportunities.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <h2 className="text-lg font-semibold tracking-tight">Headquarters</h2>
              <p className="mt-2 text-sm text-muted-foreground">Houston, TX</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Email and phone will be added here when ready.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <h2 className="text-lg font-semibold tracking-tight">Quick links</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/get-a-quote">
                  Get a Quote
                </Link>
                <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/services">
                  Services
                </Link>
                <Link className="text-muted-foreground transition-colors hover:text-foreground" href="/drive-with-us">
                  Drive With Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
