import type { Metadata } from "next";

import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { CollapsibleFAQ } from "@/components/ui/collapsible-faq";
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
        url: "/og.png",
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
    images: ["/og.png"],
  },
};

export default function ContactPage() {
  const baseUrl = "https://twinmile.com";

  const faqs = [
    {
      question: "What's the best way to contact you for urgent shipments?",
      answer: "Call us directly at (281) 710-7787 for urgent shipments. We offer 24/7 support for time-critical freight and can dispatch immediately.",
    },
    {
      question: "How quickly will I receive a response to my email?",
      answer: "Most emails are responded to within 2-4 hours during business hours. For urgent requests, please call us directly for immediate assistance.",
    },
    {
      question: "Do you offer emergency after-hours service?",
      answer: "Yes, we provide 24/7 emergency support for urgent freight needs. Our after-hours number is the same: (281) 710-7787.",
    },
    {
      question: "What information should I have ready when requesting a quote?",
      answer: "Have your pickup location, delivery destination, freight type/weight, dimensions, and any special requirements ready. This helps us provide accurate quotes quickly.",
    },
    {
      question: "Can I schedule a pickup immediately after getting a quote?",
      answer: "Yes, once you accept our quote, we can often schedule pickup within 24 hours, depending on availability and location.",
    },
    {
      question: "Do you serve all states from your Houston headquarters?",
      answer: "Yes, we provide nationwide freight transportation services from our Houston base, with strong coverage across Texas, Louisiana, California, and all other states.",
    },
    {
      question: "What types of businesses do you typically work with?",
      answer: "We work with businesses of all sizes - from small local companies to large national corporations - across industries like manufacturing, construction, e-commerce, and distribution.",
    },
    {
      question: "How do I track my shipment once it's dispatched?",
      answer: "We provide real-time tracking updates via email, SMS, or our online portal. You'll receive regular updates on pickup status, location, and estimated delivery time.",
    },
  ];

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
          <div className="mb-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-primary/40 bg-primary/8 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Availability</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">24/7</div>
              <div className="mt-2 text-sm text-foreground/80">Round-the-clock support for urgent logistics needs.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Quote Response</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">24 Hours</div>
              <div className="mt-2 text-sm text-foreground/80">Within 24 hours — usually much faster. Detailed pricing and service options.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Network</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Nationwide</div>
              <div className="mt-2 text-sm text-foreground/80">Houston-based with coverage across all 50 states.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Expert Support</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Dedicated</div>
              <div className="mt-2 text-sm text-foreground/80">Personal account managers for every client.</div>
            </div>
          </div>

          <div className="mb-10 rounded-xl border border-primary/20 bg-primary/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold tracking-tight">Services Overview</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Freight Transportation</div>
                  <div className="mt-1 text-xs text-muted-foreground">Local, regional, and long-haul freight services</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Hotshot Trucking</div>
                  <div className="mt-1 text-xs text-muted-foreground">Time-critical expedited shipping solutions</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Last-Mile Delivery</div>
                  <div className="mt-1 text-xs text-muted-foreground">Professional delivery and courier services</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Dispatching Services</div>
                  <div className="mt-1 text-xs text-muted-foreground">Complete fleet management and coordination</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Warehousing</div>
                  <div className="mt-1 text-xs text-muted-foreground">Secure storage and distribution services</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">3PL Solutions</div>
                  <div className="mt-1 text-xs text-muted-foreground">Complete third-party logistics management</div>
                </div>
              </div>
            </div>
          </div>

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
              <h2 className="text-lg font-semibold tracking-tight">Contact Options</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Phone Support</div>
                    <div className="mt-1 text-muted-foreground">24/7 availability for urgent shipments</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Email Response</div>
                    <div className="mt-1 text-muted-foreground">2-4 hours during business hours</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">Quote Requests</div>
                    <div className="mt-1 text-muted-foreground">Fast response with detailed pricing</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
            <h2 className="text-lg font-semibold tracking-tight">Why Contact Twin Mile</h2>
            <div className="mt-4 grid gap-3 text-sm text-foreground/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">Expert Logistics Team</div>
                  <div className="mt-1 text-muted-foreground">Experienced professionals handling complex shipments</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">Fast Response Guarantee</div>
                  <div className="mt-1 text-muted-foreground">Quick answers and immediate dispatch when needed</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">Personal Service Approach</div>
                  <div className="mt-1 text-muted-foreground">Dedicated account managers for every client</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="font-medium">Problem-Solving Focus</div>
                  <div className="mt-1 text-muted-foreground">Proactive solutions for logistics challenges</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur">
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
                Still have questions? We're here to help with fast, personal service.
              </div>
              <Button asChild variant="outline">
                <Link href="/get-a-quote">Get a Quote</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
