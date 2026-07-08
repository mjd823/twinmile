import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import {
  breadcrumbSchema,
  localBusinessSchema,
  orgSchema,
  webSiteSchema,
  contactPointSchema,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Twin Mile LLC | Freight Transportation | Houston Logistics",
  description:
    "Twin Mile LLC delivers fast, reliable logistics solutions nationwide — freight transportation, hotshot trucking, last‑mile delivery, dispatching, warehousing, and 3PL. 80% gross for owner-operators.",
  keywords: [
    "freight transportation",
    "hotshot trucking",
    "last mile delivery",
    "dispatching services",
    "warehousing",
    "3PL services",
    "logistics company",
    "Houston logistics",
    "Texas freight",
    "nationwide shipping",
    "owner operator jobs",
    "power only trucking",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Twin Mile LLC | Freight Transportation | Houston Logistics",
    description: "Fast. Tough. Reliable. Logistics built for the urgent — nationwide freight, hotshot, last‑mile, dispatching, warehousing, and 3PL.",
    url: "https://twinmile.com",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Twin Mile LLC — Fast. Tough. Reliable.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Twin Mile LLC | Houston Logistics",
    description: "Fast, reliable, rugged logistics solutions nationwide. Get a quote or drive with us.",
    images: ["/og.png"],
  },
};

export default async function Home() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          contactPointSchema(),
          breadcrumbSchema([{ name: "Home", url: `${baseUrl}/` }]),
        ]}
      />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Nationwide logistics • HQ: Houston, TX
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
                Fast. Tough. Reliable.
                <span className="block text-muted-foreground">Logistics built for the urgent.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Time‑critical freight and last‑mile delivery with clear communication and tight execution.
                Nationwide coverage with Houston roots.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="/get-a-quote">Get a Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/services">Explore Services</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/drive-with-us">Drive With Us</Link>
                </Button>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Expedited</div>
                  <div className="mt-1 text-muted-foreground">Same‑day / next‑day options</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Dedicated</div>
                  <div className="mt-1 text-muted-foreground">Routes that don’t slip</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 backdrop-blur">
                  <div className="text-foreground">Clear Comms</div>
                  <div className="mt-1 text-muted-foreground">Pickup → delivery visibility</div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="animate-in fade-in zoom-in-95 duration-700 rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
                <h2 className="text-lg font-semibold tracking-tight">Built for businesses that can’t wait.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Freight transportation, hotshot, courier & expedited, last‑mile delivery, dispatching, warehousing & 3PL.
                </p>
                <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Freight (Local • Regional • Long‑Haul)</div>
                    <div className="text-primary">24/7</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Hotshot & Time‑Critical Loads</div>
                    <div className="text-primary">Fast</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                    <div>Last‑Mile Delivery</div>
                    <div className="text-primary">Precise</div>
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
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                What We Do
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built for businesses that can’t afford delays. We move with precision, operate
                with strength, and keep your supply chain running.
              </p>
              <div className="mt-6 grid gap-3">
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-foreground">Freight Transportation</div>
                  <div className="mt-1">Local • Regional • Long‑Haul</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-foreground">Hotshot & Time‑Critical</div>
                  <div className="mt-1">Fast response when the clock is tight</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-foreground">Last‑Mile Delivery</div>
                  <div className="mt-1">Clean handoffs and clear communication</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-foreground">Dispatching • Warehousing • 3PL</div>
                  <div className="mt-1">Coordination + staging that keeps freight moving</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <h3 className="text-lg font-semibold tracking-tight">Time‑Critical Shipments</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Same‑day, next‑day, dedicated routes, and high‑priority freight — with clear
                communication from pickup to delivery.
              </p>
              <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Fast response</div>
                  <div className="text-primary">Minutes</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Coverage</div>
                  <div className="text-primary">Nationwide</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <div>Communication</div>
                  <div className="text-primary">Clear</div>
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
    </main>
  );
}
