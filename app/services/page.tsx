import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  breadcrumbSchema,
  localBusinessSchema,
  orgSchema,
  serviceSchema,
  webSiteSchema,
  freightServiceSchema,
  hotshotServiceSchema,
  lastMileServiceSchema,
  powerOnlyServiceSchema,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Freight Transportation Services | Hotshot | Last-Mile | Power Only",
  description:
    "Twin Mile LLC offers comprehensive logistics services: freight transportation, hotshot trucking, last-mile delivery, power only services, dispatching, warehousing, and 3PL nationwide. 80% gross for owner-operators.",
  keywords: [
    "freight transportation services",
    "hotshot trucking services",
    "last mile delivery services",
    "power only trucking",
    "dispatching services",
    "warehousing services",
    "3PL services",
    "Houston logistics services",
    "Texas freight services",
    "nationwide shipping services",
  ],
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Freight Transportation Services | Hotshot | Last-Mile | Power Only",
    description: "Comprehensive logistics services with 80% gross for owner-operators. Freight, hotshot, last-mile, power only, dispatching, warehousing, and 3PL.",
    url: "https://twinmile.com/services",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Twin Mile LLC Logistics Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Freight Transportation Services | Twin Mile LLC",
    description: "Complete logistics solutions: freight, hotshot, last-mile, power only, dispatching, warehousing, and 3PL.",
    images: ["/og.svg"],
  },
};

export default function ServicesPage() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          freightServiceSchema(),
          hotshotServiceSchema(),
          lastMileServiceSchema(),
          powerOnlyServiceSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Services", url: `${baseUrl}/services` },
          ]),
        ]}
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        <Breadcrumbs items={[{ label: "Services" }]} />
      </div>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-44 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Freight • Hotshot • Last‑mile • Dispatch • Warehousing • 3PL
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Services</h1>
            <p className="mt-4 text-muted-foreground">
              Modern logistics built for businesses that can’t afford delays.
            </p>
            <p className="mt-4 text-muted-foreground">
              We operate as a hybrid partner — carrier execution, dispatch coordination, and 3PL support — to match the reality of urgent freight.
              Whether you need a dedicated run, a hotshot response, or end‑to‑end coordination, we build the plan around your constraints.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-lg shadow-primary/20">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/service-areas">Service Areas</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/industries">Industries</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Freight Transportation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Local, regional, and long‑haul coverage — scheduled with precision and communicated clearly.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Local → OTR lanes</div>
                  <div className="text-primary">Nationwide</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Status updates</div>
                  <div className="text-primary">Clear</div>
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Hotshot Trucking</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Fast response for urgent loads and time‑critical shipments when delays aren’t an option.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Urgent loads</div>
                  <div className="text-primary">Fast</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Dedicated execution</div>
                  <div className="text-primary">Tight</div>
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Courier & Expedited Delivery</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Same‑day and next‑day delivery options for high‑priority freight and small shipments.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Same‑day / next‑day</div>
                  <div className="text-primary">Ready</div>
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Last‑Mile Delivery</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Professional delivery at the final stop — clean handoffs, on‑time performance, no excuses.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Final‑stop execution</div>
                  <div className="text-primary">Precise</div>
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Dispatching Services</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Streamlined load coordination, route planning, and operational support that keeps teams moving.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Coordination</div>
                  <div className="text-primary">Sharp</div>
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30">
              <h2 className="text-lg font-semibold tracking-tight">Warehousing & 3PL</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Storage, staging, and third‑party logistics support to bridge gaps and keep freight flowing.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Staging & storage</div>
                  <div className="text-primary">Ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">When to use what</h2>
              <p className="mt-3 text-muted-foreground">
                Most delays are predictable. The right service choice reduces risk, not just cost.
              </p>
              <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Hotshot</div>
                  <div className="mt-1">When speed matters and the load fits the equipment profile.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Freight (local → long‑haul)</div>
                  <div className="mt-1">For planned schedules, heavier loads, and dedicated execution.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Last‑mile</div>
                  <div className="mt-1">For final‑stop delivery where professionalism and accuracy matter.</div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7">
              <div className="rounded-2xl border border-border/60 bg-card/40 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-10">
                <h3 className="text-xl font-semibold tracking-tight">Common use‑cases we run</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  Examples of time‑critical and operations‑critical situations where execution and communication are the difference.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                    <div className="text-sm font-semibold tracking-tight">Urgent parts & equipment</div>
                    <div className="mt-2 text-sm text-muted-foreground">Prevent downtime with expedited pickup and direct delivery.</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                    <div className="text-sm font-semibold tracking-tight">Construction jobsite deliveries</div>
                    <div className="mt-2 text-sm text-muted-foreground">Access constraints, timing windows, and clean handoffs.</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                    <div className="text-sm font-semibold tracking-tight">Retail replenishment</div>
                    <div className="mt-2 text-sm text-muted-foreground">Tight appointment windows and zero‑excuse delivery.</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                    <div className="text-sm font-semibold tracking-tight">Distribution overflow</div>
                    <div className="mt-2 text-sm text-muted-foreground">Staging + coordination when freight volume spikes.</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="shadow-lg shadow-primary/20">
                    <Link href="/get-a-quote">Request Quote</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/contact">Talk to us</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Communication & execution</h2>
              <p className="mt-3 text-muted-foreground">
                The load is only half the job. The other half is visibility and follow‑through.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Update cadence</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Proactive updates at pickup, in‑transit, and delivery — plus immediate notification when anything changes.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Documentation</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Proof of delivery, paperwork requirements, and close‑out follow‑through handled cleanly.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Hybrid coverage</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    When a job needs more reach, dispatch coordination and 3PL support extend coverage without sacrificing standards.
                  </div>
                </div>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                Explore where we run: <Link className="text-primary underline-offset-4 hover:underline" href="/service-areas">Service Areas</Link>
                {" "}• Explore who we serve: <Link className="text-primary underline-offset-4 hover:underline" href="/industries">Industries</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">FAQ</h2>
              <p className="mt-3 text-muted-foreground">
                Quick answers to common service questions.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">How fast do you respond?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Fast. Share the lane and constraints and we’ll respond with a clear plan.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Hotshot vs freight — which should I choose?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Hotshot is for urgency and equipment fit. Freight is ideal for heavier loads, planned schedules, and broader lane options.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Do you operate nationwide?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Yes. We support nationwide coverage with strong lanes across Texas, Louisiana, California, and beyond.
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="/get-a-quote">Get a Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Contact</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Response speed</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Fast</div>
              <div className="mt-2 text-sm text-muted-foreground">We reply quickly and keep communication tight.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Coverage</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Nationwide</div>
              <div className="mt-2 text-sm text-muted-foreground">Local, regional, and long‑haul execution.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Operations</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Reliable</div>
              <div className="mt-2 text-sm text-muted-foreground">Professional handoffs and consistent follow‑through.</div>
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
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Move urgent freight with a team that executes.</h2>
                <p className="mt-3 text-muted-foreground">
                  Tell us the lane, timing, and constraints — we’ll respond fast with a clear plan.
                </p>
              </div>
              <div className="md:col-span-4 md:flex md:justify-end">
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="shadow-lg shadow-primary/20">
                    <Link href="/get-a-quote">Get a Quote</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/contact">Contact</Link>
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
