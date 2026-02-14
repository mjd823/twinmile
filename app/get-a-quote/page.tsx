import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { QuoteForm } from "@/components/forms/quote-form";

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
  title: "Get Freight Quote | Houston Logistics | Fast Quote | Twin Mile LLC",
  description:
    "Request a freight quote from Twin Mile LLC. Fast quotes for freight transportation, hotshot trucking, last-mile delivery, and power only services. Houston-based logistics nationwide.",
  keywords: [
    "freight quote",
    "get freight quote",
    "Houston freight quote",
    "Texas freight quote",
    "hotshot quote",
    "last mile delivery quote",
    "power only quote",
    "logistics quote",
    "shipping quote",
    "transportation quote",
    "fast freight quote",
    "urgent freight quote",
  ],
  alternates: { canonical: "/get-a-quote" },
  openGraph: {
    title: "Get Freight Quote | Houston Logistics | Fast Quote | Twin Mile LLC",
    description: "Request a fast freight quote from Twin Mile LLC. Freight, hotshot, last-mile, and power only services. Houston-based logistics.",
    url: "https://twinmile.com/get-a-quote",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Get Freight Quote - Twin Mile LLC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Get Freight Quote | Twin Mile LLC",
    description: "Request a fast freight quote from Twin Mile LLC. Freight, hotshot, last-mile, and power only services.",
    images: ["/og.svg"],
  },
};

export default function GetAQuotePage() {
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
            { name: "Get a Quote", url: `${baseUrl}/get-a-quote` },
          ]),
          serviceSchema({
            name: "Freight Quote Request",
            description: "Request a freight quote for time-critical, local, regional, or long-haul shipments nationwide.",
            url: `${baseUrl}/get-a-quote`,
          }),
        ]}
      />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-44 left-1/3 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Fast response • Nationwide coverage
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Get a Quote</h1>
            <p className="mt-4 text-base text-foreground/85 md:text-lg">
              Tell us what you’re moving and where it’s going. We’ll respond fast with a clear plan.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-xl border border-primary/25 bg-card/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <QuoteForm />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">What happens next</h2>
              <div className="mt-4 grid gap-3 text-sm text-foreground/80">
                <div>Fast response and clear communication.</div>
                <div>Time-critical support for urgent loads.</div>
                <div>Nationwide coverage — local to long-haul.</div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">Service focus</h2>
              <div className="mt-4 grid gap-3 text-sm text-foreground/80">
                <div>Freight Transportation</div>
                <div>Hotshot Trucking</div>
                <div>Last-mile delivery</div>
                <div>Dispatching and 3PL</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
