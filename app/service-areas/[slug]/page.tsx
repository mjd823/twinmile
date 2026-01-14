import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema } from "@/lib/seo";

const AREAS = {
  texas: {
    title: "Texas",
    description:
      "Logistics coverage across Texas — local, regional, and long-haul freight with time-critical support.",
  },
  louisiana: {
    title: "Louisiana",
    description:
      "Logistics coverage across Louisiana — fast response, clear communication, and rugged reliability.",
  },
  california: {
    title: "California",
    description:
      "Logistics coverage across California — freight, expedited delivery, and long-haul coordination.",
  },
  nationwide: {
    title: "Nationwide",
    description:
      "Nationwide logistics coverage across the United States for urgent and high-priority freight.",
  },
} as const;

type Slug = keyof typeof AREAS;

export function generateStaticParams() {
  return Object.keys(AREAS).map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const area = AREAS[slug as Slug];
    if (!area) return { title: "Service Area" };

    return {
      title: `Service Area: ${area.title}`,
      description: area.description,
      alternates: { canonical: `/service-areas/${slug}` },
    };
  });
}

export default async function ServiceAreaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = AREAS[slug as Slug];
  if (!area) notFound();

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
            { name: "Service Areas", url: `${baseUrl}/service-areas` },
            { name: area.title, url: `${baseUrl}/service-areas/${slug}` },
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
            <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="/service-areas">
              ← Back to Service Areas
            </Link>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Coverage hub • Time‑critical execution
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">{area.title}</h1>
            <p className="mt-4 text-muted-foreground">{area.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-lg shadow-primary/20">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/services">Explore Services</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <div className="text-lg font-semibold tracking-tight">Services we run in {area.title}</div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div>Freight transportation (local / regional / long‑haul)</div>
                <div>Hotshot and time‑critical loads</div>
                <div>Expedited and last‑mile delivery</div>
                <div>Dispatch coordination and 3PL support</div>
              </div>
              <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Response</div>
                  <div className="text-primary">Fast</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Visibility</div>
                  <div className="text-primary">Clear</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <div className="text-lg font-semibold tracking-tight">Typical lanes & coverage</div>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Local + regional</div>
                  <div className="mt-1">Daily routes with tight windows and clean handoffs.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Long‑haul</div>
                  <div className="mt-1">Nationwide execution planned around constraints, not assumptions.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Time‑critical</div>
                  <div className="mt-1">Urgent pickups with proactive updates and documented changes.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How we run loads here</h2>
              <p className="mt-3 text-muted-foreground">
                Service quality is built in the process. We remove ambiguity before it becomes a delay.
              </p>
            </div>
            <div className="md:col-span-7">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Intake → constraints</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Access notes, contact names, pickup/drop windows, paperwork requirements — confirmed up front.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Plan → equipment + route</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Right equipment, realistic timing, and a contingency when the schedule is tight.
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                  <div className="text-sm font-semibold tracking-tight">Execute → updates</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Proactive updates at pickup, in‑transit, and delivery — with immediate notification when anything changes.
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
    </main>
  );
}
