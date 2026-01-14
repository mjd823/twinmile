import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";

import { breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Twin Mile LLC — a modern logistics company delivering fast, reliable, rugged transportation and 3PL solutions nationwide.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "About", url: `${baseUrl}/about` },
          ]),
        ]}
      />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-44 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Built for the urgent • Nationwide execution
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">About</h1>
            <p className="mt-4 text-muted-foreground">
              Twin Mile LLC is a hybrid logistics partner — carrier execution, dispatch coordination, and 3PL support — built for businesses that can’t afford delays.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <h2 className="text-lg font-semibold tracking-tight">Mission</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Move urgent freight with tight coordination — fast response, clear communication, and execution that holds up under pressure.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                We exist to remove uncertainty from logistics: tighter planning, fewer surprises, and a clean handoff from pickup to delivery.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <h2 className="text-lg font-semibold tracking-tight">What we are</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Twin Mile is built as a hybrid operator:
              </p>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Carrier execution</div>
                  <div className="text-primary">Run the load</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Dispatch coordination</div>
                  <div className="text-primary">Plan the route</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>3PL support</div>
                  <div className="text-primary">Scale coverage</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                That structure gives you flexibility: we execute directly when it makes sense, and we coordinate the broader plan when the job needs more reach.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                <h2 className="text-lg font-semibold tracking-tight">How we operate</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Time‑critical shipping doesn’t fail because trucks don’t exist — it fails because details do. Our process is built to remove ambiguity.
                </p>
                <div className="mt-6 grid gap-3">
                  <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                    <div className="text-foreground">1) Intake</div>
                    <div className="mt-1">Confirm constraints: timing, access, contacts, paperwork, handling requirements.</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                    <div className="text-foreground">2) Plan</div>
                    <div className="mt-1">Right equipment + route + contingency. No guessing. No vague handoffs.</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                    <div className="text-foreground">3) Execute</div>
                    <div className="mt-1">On‑time pickup and delivery with proactive updates when anything changes.</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                    <div className="text-foreground">4) Closeout</div>
                    <div className="mt-1">Proof of delivery, documentation, and post‑load follow‑through.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                <h2 className="text-lg font-semibold tracking-tight">Operating principles</h2>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Speed</div>
                    <div className="text-primary">Fast response</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Clarity</div>
                    <div className="text-primary">No surprises</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Accountability</div>
                    <div className="text-primary">Own outcomes</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Safety</div>
                    <div className="text-primary">Do it right</div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  If something changes, we communicate early. If something breaks, we fix it. That’s the standard.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-10">
            <div className="grid gap-8 md:grid-cols-12">
              <div className="md:col-span-7">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Why Twin Mile</h2>
                <p className="mt-3 text-muted-foreground">
                  Most logistics failures are preventable. The difference is an operator that treats details like the product.
                </p>
                <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                  <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="text-foreground">Hybrid capability</div>
                    <div className="mt-1">Carrier + dispatch + 3PL means we execute and coordinate with flexibility.</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="text-foreground">Time‑critical mindset</div>
                    <div className="mt-1">Urgent freight is treated as urgent — planning, comms, and execution stay tight.</div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="text-foreground">Communication as a service</div>
                    <div className="mt-1">Updates are proactive and written. Visibility is part of the job, not a bonus.</div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-5">
                <h3 className="text-lg font-semibold tracking-tight">Nationwide footprint</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Houston roots with national lanes. We support local, regional, and long‑haul coverage — and build the plan around your constraints.
                </p>
                <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Primary focus</div>
                    <div className="text-primary">Time‑critical</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Coverage</div>
                    <div className="text-primary">Nationwide</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>HQ</div>
                    <div className="text-primary">Houston, TX</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 left-1/2 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-12">
              <div className="md:col-span-8">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Ready to move?</h2>
                <p className="mt-3 text-muted-foreground">
                  Share the lane, timing, and constraints — we’ll respond fast with a clear plan.
                </p>
              </div>
              <div className="md:col-span-4 md:flex md:justify-end">
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="shadow-lg shadow-primary/20">
                    <Link href="/get-a-quote">Get a Quote</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/services">Explore Services</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
