import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { breadcrumbSchema, localBusinessSchema, orgSchema } from "@/lib/seo";

const INDUSTRIES = {
  construction: {
    title: "Construction",
    description:
      "Time-critical logistics support for construction materials, equipment, and urgent site deliveries.",
  },
  ecommerce: {
    title: "E-commerce",
    description:
      "Fast fulfillment support for e-commerce brands: last-mile delivery, expedited shipments, and 3PL coordination.",
  },
  manufacturing: {
    title: "Manufacturing",
    description:
      "Reliable freight movement for manufacturers with tight timelines and high-priority shipments.",
  },
  medical: {
    title: "Medical",
    description:
      "Urgent delivery support for medical suppliers and time-sensitive shipments.",
  },
  distribution: {
    title: "Distribution",
    description:
      "Streamlined freight coordination for distributors and warehouses across regional and nationwide lanes.",
  },
} as const;

type Slug = keyof typeof INDUSTRIES;

export function generateStaticParams() {
  return Object.keys(INDUSTRIES).map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    const industry = INDUSTRIES[slug as Slug];
    if (!industry) return { title: "Industry" };

    return {
      title: `Industry: ${industry.title}`,
      description: industry.description,
      alternates: { canonical: `/industries/${slug}` },
    };
  });
}

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = INDUSTRIES[slug as Slug];
  if (!industry) notFound();

  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Industries", url: `${baseUrl}/industries` },
            { name: industry.title, url: `${baseUrl}/industries/${slug}` },
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
            <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href="/industries">
              ← Back to Industries
            </Link>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Industry support • Time‑critical execution
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">{industry.title}</h1>
            <p className="mt-4 text-muted-foreground">{industry.description}</p>
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
              <div className="text-lg font-semibold tracking-tight">How we help</div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div>Fast response times for urgent shipments and operational surprises.</div>
                <div>Dedicated routes and high‑priority options when timing is tight.</div>
                <div>Clear communication from pickup to delivery — documented changes, no guessing.</div>
                <div>Hybrid support (carrier + dispatch + 3PL) to match real‑world constraints.</div>
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

            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <div className="text-lg font-semibold tracking-tight">Common scenarios</div>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <div className="text-foreground">Missed windows</div>
                  <div className="mt-1">Tight scheduling and early confirmation to prevent slips.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <div className="text-foreground">Access constraints</div>
                  <div className="mt-1">Gate codes, dock rules, jobsite restrictions — captured up front.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <div className="text-foreground">Urgent parts</div>
                  <div className="mt-1">Expedited pickup and direct execution when downtime is costly.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
