import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbSchema, localBusinessSchema, orgSchema } from "@/lib/seo";

const AREAS = [
  { slug: "texas", name: "Texas" },
  { slug: "louisiana", name: "Louisiana" },
  { slug: "california", name: "California" },
  { slug: "nationwide", name: "Nationwide" },
];

export const metadata: Metadata = {
  title: "Service Areas",
  description:
    "Twin Mile LLC provides nationwide logistics with strong coverage across Texas, Louisiana, California, and beyond.",
  alternates: { canonical: "/service-areas" },
};

export default function ServiceAreasPage() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Service Areas", url: `${baseUrl}/service-areas` },
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
              Nationwide coverage • Strong lanes across TX, LA, CA and beyond
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Service Areas</h1>
            <p className="mt-4 text-muted-foreground">
              We operate nationwide with tight execution for time‑critical freight, last‑mile delivery, and dedicated routes.
              Browse key coverage hubs below.
            </p>
            <p className="mt-4 text-muted-foreground">
              Coverage isn’t just geography — it’s communication, standards, and follow‑through. We run as a hybrid partner (carrier + dispatch + 3PL)
              so you get execution when it matters and coordination when the lane needs more reach.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-lg shadow-primary/20">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/services">Explore Services</Link>
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
          <div className="grid gap-4 md:grid-cols-2">
            {AREAS.map((a) => (
              <Link
                key={a.slug}
                href={`/service-areas/${a.slug}`}
                className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-card/50 hover:shadow-2xl hover:shadow-black/30"
              >
                <div className="text-lg font-semibold tracking-tight">{a.name}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Coverage details, typical lanes, and service types we run in this region.
                </div>
                <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Expedited options</div>
                    <div className="text-primary">Available</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Communication</div>
                    <div className="text-primary">Clear</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How coverage works</h2>
              <p className="mt-3 text-muted-foreground">
                We treat every lane like an execution plan — constraints first, then equipment, then communication.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">1) Confirm constraints</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Pickup/drop windows, access notes, dock rules, contacts, and paperwork requirements — captured up front.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">2) Match equipment</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Equipment fit and timing reality drive the plan — especially on time‑critical lanes.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">3) Execute with visibility</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Proactive updates at pickup, in‑transit, and delivery — and immediate notification when anything changes.
                  </div>
                </div>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                Want the full breakdown? <Link className="text-primary underline-offset-4 hover:underline" href="/services">View Services</Link>
                {" "}or explore how we support your operation in <Link className="text-primary underline-offset-4 hover:underline" href="/industries">Industries</Link>.
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">What we run across these lanes</h2>
              <p className="mt-3 text-muted-foreground">
                Most shipments fall into a few categories — the difference is whether the plan is built for the constraints.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                  <div className="text-sm font-semibold tracking-tight">Time‑critical freight</div>
                  <div className="mt-2 text-sm text-muted-foreground">Urgent lanes with tight windows and clean documentation.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                  <div className="text-sm font-semibold tracking-tight">Dedicated routes</div>
                  <div className="mt-2 text-sm text-muted-foreground">Recurring lanes where reliability matters more than noise.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                  <div className="text-sm font-semibold tracking-tight">Last‑mile delivery</div>
                  <div className="mt-2 text-sm text-muted-foreground">Professional handoff, access constraints, and appointment windows.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-5">
                  <div className="text-sm font-semibold tracking-tight">Overflow coordination</div>
                  <div className="mt-2 text-sm text-muted-foreground">When volume spikes, dispatch + 3PL support keeps freight moving.</div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="/get-a-quote">Request Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Contact</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">FAQ</h2>
              <p className="mt-3 text-muted-foreground">Quick answers about coverage and how we operate.</p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Do you operate nationwide?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Yes. We support nationwide coverage with strong lanes across Texas, Louisiana, California, and beyond.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">How fast can you respond to a quote request?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Fast. Share the lane, windows, and constraints and we’ll respond with a clear plan.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">What details do you need to avoid surprises?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Pickup/drop windows, access notes, contacts, paperwork requirements, and special handling (appointments, liftgate, limited access).
                  </div>
                </div>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                For more detail, see our logistics guide in the <Link className="text-primary underline-offset-4 hover:underline" href="/blog">Blog</Link>.
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
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Need nationwide coverage with urgent execution?</h2>
                <p className="mt-3 text-muted-foreground">
                  Share the pickup, dropoff, and timing — we’ll respond fast with a clear plan.
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
