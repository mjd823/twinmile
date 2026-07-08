import type { Metadata } from "next";

import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { QuoteForm } from "@/components/forms/quote-form";
import { Button } from "@/components/ui/button";
import { CollapsibleFAQ } from "@/components/ui/collapsible-faq";
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
  faqSchema,
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
        url: "/og.png",
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
    images: ["/og.png"],
  },
};

export default function GetAQuotePage() {
  const baseUrl = "https://twinmile.com";

  const faqs = [
    {
      question: "How fast will I receive a quote?",
      answer: "We respond within 24 hours — usually much faster during business hours. For urgent requests, call us directly at (281) 710-7787 for immediate assistance.",
    },
    {
      question: "What types of freight do you handle?",
      answer: "We handle all freight types including general cargo, time-critical shipments, hotshot loads, last-mile deliveries, and specialized power only services.",
    },
    {
      question: "Do you serve all states?",
      answer: "Yes, we provide nationwide freight transportation with strong coverage across Texas, Louisiana, California, and all other states.",
    },
    {
      question: "What information do you need for a quote?",
      answer: "We need pickup location, delivery location, freight type/weight, dimensions, and any special requirements. The more details you provide, the more accurate your quote.",
    },
    {
      question: "Do you offer expedited services?",
      answer: "Yes, we specialize in time-critical and expedited freight services with dedicated trucks and priority routing for urgent shipments.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept cash, credit cards, ACH transfers, and offer net payment terms for established business customers.",
    },
    {
      question: "Do you provide tracking?",
      answer: "Yes, all shipments include real-time tracking with regular updates on location and estimated delivery times.",
    },
    {
      question: "Are you insured and bonded?",
      answer: "Yes, we carry comprehensive cargo insurance, liability coverage, and are fully licensed and bonded for all transportation services.",
    },
  ];

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
          faqSchema(faqs, `${baseUrl}/get-a-quote`),
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

      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        <Breadcrumbs items={[{ label: "Get a Quote" }]} />
      </div>

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
          <div className="mb-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-primary/40 bg-primary/8 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Quote Response</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">24 Hours</div>
              <div className="mt-2 text-sm text-foreground/80">Within 24 hours — usually much faster. Accurate pricing with detailed service breakdowns.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">On-Time Delivery</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">95%</div>
              <div className="mt-2 text-sm text-foreground/80">Reliable service with real-time tracking and updates.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Coverage</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Nationwide</div>
              <div className="mt-2 text-sm text-foreground/80">From local Houston routes to cross-country freight.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Support</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">24/7</div>
              <div className="mt-2 text-sm text-foreground/80">Round-the-clock assistance for urgent shipments.</div>
            </div>
          </div>

          <div className="mb-10 rounded-xl border border-primary/20 bg-primary/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold tracking-tight">Why Choose Twin Mile</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Fast Response Times</div>
                  <div className="mt-1 text-xs text-muted-foreground">Quotes within 24 hours, immediate support for urgent requests</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Transparent Pricing</div>
                  <div className="mt-1 text-xs text-muted-foreground">No hidden fees, clear breakdowns, competitive rates</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Dedicated Support</div>
                  <div className="mt-1 text-xs text-muted-foreground">Personal account manager and 24/7 availability</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Real-Time Tracking</div>
                  <div className="mt-1 text-xs text-muted-foreground">Live updates on shipment status and ETA</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Expert Logistics</div>
                  <div className="mt-1 text-xs text-muted-foreground">Experienced team handling complex shipments</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Full Coverage</div>
                  <div className="mt-1 text-xs text-muted-foreground">Comprehensive insurance and liability protection</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-xl border border-primary/25 bg-card/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <QuoteForm />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight">What happens next</h2>
              <div className="mt-4 grid gap-3 text-sm text-foreground/80">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Fast Response</div>
                    <div className="mt-1 text-muted-foreground">Receive your detailed quote within 24 hours with transparent pricing.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Dedicated Support</div>
                    <div className="mt-1 text-muted-foreground">Personal account manager handles your shipment from start to finish.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Real-Time Tracking</div>
                    <div className="mt-1 text-muted-foreground">Live updates on your shipment status with accurate ETAs.</div>
                  </div>
                </div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">Service Benefits</h2>
              <div className="mt-4 grid gap-3 text-sm text-foreground/80">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">No Hidden Fees</div>
                    <div className="mt-1 text-muted-foreground">Transparent pricing with detailed cost breakdowns.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Full Insurance Coverage</div>
                    <div className="mt-1 text-muted-foreground">Comprehensive cargo insurance for peace of mind.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Professional Communication</div>
                    <div className="mt-1 text-muted-foreground">Regular updates and proactive issue resolution.</div>
                  </div>
                </div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">Service focus</h2>
              <div className="mt-4 grid gap-3 text-sm text-foreground/80">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>Freight Transportation</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>Hotshot Trucking</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>Last-mile delivery</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>Dispatching and 3PL</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="mt-14 rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {faqs.map((f) => (
                <CollapsibleFAQ key={f.question} question={f.question} answer={f.answer} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Need immediate assistance? Call us for fast, personal service.
              </div>
              <Button asChild variant="outline">
                <Link href="/contact">Contact us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
