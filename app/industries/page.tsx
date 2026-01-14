import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema } from "@/lib/seo";

const INDUSTRIES = [
  { slug: "construction", name: "Construction" },
  { slug: "ecommerce", name: "E-commerce" },
  { slug: "manufacturing", name: "Manufacturing" },
  { slug: "medical", name: "Medical" },
  { slug: "distribution", name: "Distribution" },
];

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Twin Mile LLC supports time-critical logistics for construction, e-commerce, manufacturing, medical, and distribution businesses.",
  alternates: { canonical: "/industries" },
};

export default function IndustriesPage() {
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
            { name: "Industries", url: `${baseUrl}/industries` },
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
              Built for high‑priority freight • Time‑critical operations
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Industries</h1>
            <p className="mt-4 text-muted-foreground">
              Different industries have different failure points — our job is to eliminate them.
              Explore examples below.
            </p>
            <p className="mt-4 text-muted-foreground">
              Twin Mile operates as a hybrid partner: carrier execution, dispatch coordination, and 3PL support.
              That means you get a clear plan and clean follow‑through — even when constraints change.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-lg shadow-primary/20">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/services">Explore Services</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/service-areas">Service Areas</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-4 md:grid-cols-2">
            {INDUSTRIES.map((i) => (
              <Link
                key={i.slug}
                href={`/industries/${i.slug}`}
                className="group rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-card/50 hover:shadow-2xl hover:shadow-black/30"
              >
                <div className="text-lg font-semibold tracking-tight">{i.name}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Time‑critical freight and streamlined coordination tailored to this industry.
                </div>
                <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>On‑time performance</div>
                    <div className="text-primary">Tight</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Visibility</div>
                    <div className="text-primary">Clear</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">The failure points we eliminate</h2>
              <p className="mt-3 text-muted-foreground">
                The freight is rarely the problem — ambiguity is. We build the plan around constraints and keep communication tight.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Missed windows</div>
                  <div className="mt-2 text-sm text-muted-foreground">Confirm readiness, appointments, and realistic ETAs early.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Access constraints</div>
                  <div className="mt-2 text-sm text-muted-foreground">Gate codes, jobsite rules, dock policies — captured up front.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Poor visibility</div>
                  <div className="mt-2 text-sm text-muted-foreground">Proactive updates at pickup/in‑transit/delivery, with escalation when needed.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Paperwork gaps</div>
                  <div className="mt-2 text-sm text-muted-foreground">Proof of delivery, documentation, and close‑out handled cleanly.</div>
                </div>
              </div>
              <div className="mt-6 text-sm text-muted-foreground">
                Want practical guidance? Read the <Link className="text-primary underline-offset-4 hover:underline" href="/blog">Blog</Link>.
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">FAQ</h2>
              <p className="mt-3 text-muted-foreground">Quick answers about how we support different operations.</p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Do you support dedicated routes?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Yes. Dedicated lanes work best when timing windows and handoffs are clearly defined.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Can you handle urgent shipments?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Yes. We prioritize time‑critical execution and treat communication like an SLA.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">What information should we provide to get an accurate plan?</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Lane, timing windows, access notes, contacts, paperwork requirements, and special handling constraints.
                  </div>
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
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Tell us your constraints — we’ll build the plan.</h2>
                <p className="mt-3 text-muted-foreground">
                  Timeline, access restrictions, paperwork, special handling — we coordinate the details so loads don’t slip.
                </p>
              </div>
              <div className="md:col-span-4 md:flex md:justify-end">
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="shadow-lg shadow-primary/20">
                    <Link href="/get-a-quote">Get a Quote</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/services">View Services</Link>
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
