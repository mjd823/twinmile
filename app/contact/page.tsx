import type { Metadata } from "next";

import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";

import { breadcrumbSchema, localBusinessSchema, orgSchema, webSiteSchema, contactPointSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Twin Mile LLC | Houston Logistics | (281) 710-7787",
  description:
    "Contact Twin Mile LLC for freight quotes, dispatching, last-mile delivery, hotshot trucking, warehousing, and 3PL nationwide. Call (281) 710-7787 or email admin@twinmile.com.",
  keywords: [
    "contact Twin Mile LLC",
    "Houston logistics contact",
    "freight quote contact",
    "hotshot trucking contact",
    "last mile delivery contact",
    "dispatching services contact",
    "warehousing contact",
    "3PL services contact",
    "Texas logistics contact",
    "freight transportation contact",
  ],
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Twin Mile LLC | Houston Logistics | (281) 710-7787",
    description: "Get in touch with Twin Mile LLC for all your logistics needs. Call (281) 710-7787 or email admin@twinmile.com.",
    url: "https://twinmile.com/contact",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Contact Twin Mile LLC - Houston Logistics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Twin Mile LLC | (281) 710-7787",
    description: "Contact Twin Mile LLC for freight quotes and logistics services. Call (281) 710-7787 or email admin@twinmile.com.",
    images: ["/og.svg"],
  },
};

export default function ContactPage() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          contactPointSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Contact", url: `${baseUrl}/contact` },
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
              <div className="mt-4 grid gap-2 text-sm">
                <a
                  href="tel:+12817107787"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  (281) 710-7787
                </a>
                <a
                  href="mailto:admin@twinmile.com"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  admin@twinmile.com
                </a>
              </div>
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
