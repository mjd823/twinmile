import type { Metadata } from "next";

import Link from "next/link";
import { DriverApplicationForm } from "@/components/forms/driver-application-form";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { CollapsibleFAQ } from "@/components/ui/collapsible-faq";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  breadcrumbSchema,
  faqSchema,
  localBusinessSchema,
  orgSchema,
  webSiteSchema,
  jobPostingSchema,
  employerRatingSchema,
  contactPointSchema,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Owner Operator Jobs Houston | 80% Gross | Power Only | Twin Mile LLC",
  description:
    "Join Twin Mile LLC as an owner-operator in Houston. Power only trucking with 80% gross, $250k-$350k potential, 100% fuel surcharge, weekly direct deposit. Apply in 2 minutes.",
  keywords: [
    "owner operator jobs Houston",
    "power only owner operator",
    "hotshot driver jobs Texas",
    "lease on authority 80% gross",
    "truck driving jobs Houston",
    "owner operator opportunities",
    "power only trucking companies",
    "Houston logistics jobs",
    "Texas truck driver jobs",
    "owner operator lease on",
  ],
  alternates: { canonical: "/drive-with-us" },
  openGraph: {
    title: "Owner Operator Jobs Houston | 80% Gross | Twin Mile LLC",
    description: "Power only owner operator jobs with 80% gross, $250k-$350k potential. Weekly direct deposit, 100% fuel surcharge. Apply in 2 minutes.",
    url: "https://twinmile.com/drive-with-us",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Owner Operator Jobs Houston - 80% Gross - Twin Mile LLC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Owner Operator Jobs Houston | 80% Gross | Twin Mile LLC",
    description: "Power only trucking with 80% gross, $250k-$350k potential. Apply in 2 minutes.",
    images: ["/og.svg"],
  },
};

export default function DriveWithUsPage() {
  const baseUrl = "https://twinmile.com";
  const today = new Date().toISOString().split('T')[0];

  const faqs = [
    {
      question: "How does the application work?",
      answer:
        "Submit the short application, then our team reviews it and reaches out for a quick call/text to confirm availability, equipment, and lanes. If it's a fit, we'll guide you through onboarding and dispatch." ,
    },
    {
      question: "How fast will you respond to an application?",
      answer:
        "Most applicants hear back within 1 business day. During high volume, it may take a bit longer — but we review every submission.",
    },
    {
      question: "Do you hire owner-operators with their own trucks?",
      answer:
        "Yes. We work with owner-operators and small fleets with their own equipment for time-critical freight nationwide.",
    },
    {
      question: "What routes do you run?",
      answer:
        "We operate nationwide, with strong coverage across Texas, Louisiana, California, and beyond. We'll match lanes based on your availability and equipment.",
    },
    {
      question: "What do you need from me to get started?",
      answer:
        "At minimum: basic contact info, your equipment type, and your availability. If we move forward, we'll request standard onboarding documents and insurance details (owner-operators).",
    },
    {
      question: "Is this a W-2 role or 1099/owner-operator?",
      answer:
        "We support owner-operators and contractors. If you're applying as a company driver, mention it in the notes and we'll confirm options based on current openings.",
    },
    {
      question: "What is the pay structure?",
      answer:
        "Owner-operators earn 80% gross to the truck with $250k-$350k+ annual gross potential. We provide 100% fuel surcharge, weekly direct deposit, and no hidden fees.",
    },
    {
      question: "What equipment do I need?",
      answer:
        "We focus on power only operations, so you need your own tractor. Common equipment includes hotshot trucks, semi-trucks, and specialized vehicles. No trailer required.",
    },
  ];

  const jobPostingData = {
    title: "Owner Operator - Power Only Trucking - Houston, TX",
    description: "Join Twin Mile LLC as an owner-operator specializing in power only trucking. Earn 80% gross with $250k-$350k+ annual potential, 100% fuel surcharge, weekly direct deposit, and no trailer fees. Houston-based with nationwide lanes.",
    datePosted: today,
    employmentType: "CONTRACTOR",
    hiringOrganization: {
      name: "Twin Mile LLC",
      sameAs: "https://twinmile.com",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Houston",
        addressRegion: "TX",
        addressCountry: "US",
        postalCode: "77002",
      },
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        minValue: 250000,
        maxValue: 350000,
        unitText: "YEAR",
      },
    },
    qualifications: "Valid CDL-A, 2+ years OTR experience, clean MVR, reliable DOT-compliant tractor, safety-first mindset. Owner-operators must have proper insurance and operating authority.",
    responsibilities: "Transport freight using power only equipment, maintain professional communication, ensure on-time deliveries, follow safety protocols, manage vehicle maintenance, represent Twin Mile professionally.",
    workHours: "Flexible schedule - OTR and regional routes available",
    applicantLocationRequirements: {
      "@type": "Country",
      address: {
        "@type": "PostalAddress",
        addressCountry: "US",
      },
    },
    url: `${baseUrl}/drive-with-us#apply`,
  };

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          contactPointSchema(),
          employerRatingSchema(),
          jobPostingSchema(jobPostingData),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Drive With Us", url: `${baseUrl}/drive-with-us` },
          ]),
          faqSchema(faqs, `${baseUrl}/drive-with-us`),
        ]}
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-6">
        <Breadcrumbs items={[{ label: "Drive With Us" }]} />
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
              Owner-operators & drivers • Nationwide lanes
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Drive With Us</h1>
            <p className="mt-4 text-base text-foreground/85 md:text-lg">
              Apply in minutes. We’ll review and reach out with next steps.
              Owner-operators and professional drivers — nationwide lanes.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="mb-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-primary/40 bg-primary/8 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Owner-operators</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">80% Gross</div>
              <div className="mt-2 text-sm text-foreground/80">To the truck. Competitive pay, transparent settlement.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Communication</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Clear</div>
              <div className="mt-2 text-sm text-foreground/80">Professional expectations and tight updates.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Lanes</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Nationwide</div>
              <div className="mt-2 text-sm text-foreground/80">Strong coverage across TX, LA, CA and beyond.</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Opportunity</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">Time‑critical</div>
              <div className="mt-2 text-sm text-foreground/80">High‑priority loads and dedicated routes.</div>
            </div>
          </div>

          <div className="mb-10 rounded-xl border border-primary/20 bg-primary/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold tracking-tight">Pay & Perks</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">$250k-$350k+ Annual Gross</div>
                  <div className="mt-1 text-xs text-muted-foreground">High-value, consistent lanes with strong earning potential</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">100% Fuel Surcharge</div>
                  <div className="mt-1 text-xs text-muted-foreground">No hidden fees — you keep the full surcharge</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Weekly Direct Deposit</div>
                  <div className="mt-1 text-xs text-muted-foreground">Reliable, transparent settlements every week</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">National Maintenance Network</div>
                  <div className="mt-1 text-xs text-muted-foreground">Access corporate pricing at Love's shops</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Business Support</div>
                  <div className="mt-1 text-xs text-muted-foreground">Fuel advances, ELD, and fuel discounts included</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">Power Only Focus</div>
                  <div className="mt-1 text-xs text-muted-foreground">No trailer fees or maintenance — maximize your uptime</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-sm text-foreground/80 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">1</div>
                    <div className="font-medium">Apply</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Submit the short form with your contact info, equipment, and availability.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-sm text-foreground/80 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">2</div>
                    <div className="font-medium">Confirm</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Quick call/text to confirm equipment, routes, and expectations.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-3 text-sm text-foreground/80 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">3</div>
                    <div className="font-medium">Onboard</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">If it's a fit, we'll guide you through onboarding and get you dispatched.</div>
                </div>
              </div>

              <h2 className="mt-8 text-lg font-semibold tracking-tight">What we need</h2>
              <div className="mt-3 grid gap-2 text-xs text-foreground/80">
                <div>Clear communication.</div>
                <div>Owner-operators with their own equipment.</div>
                <div>Professional, on-time performance.</div>
                <div>Safety-first mindset.</div>
              </div>

              <h2 className="mt-8 text-lg font-semibold tracking-tight">Before you apply</h2>
              <div className="mt-3 grid gap-2 text-xs text-foreground/80">
                <div>Have your equipment type and availability ready.</div>
                <div>Be specific about preferred lanes and start date (ASAP is fine).</div>
                <div>If you're an owner-operator, mention your insurance and operating authority.</div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="#apply">Apply now</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Contact us</Link>
                </Button>
              </div>
            </div>

            <div
              id="apply"
              className="rounded-xl border border-primary/25 bg-card/55 p-6 shadow-xl shadow-black/20 backdrop-blur"
            >
              <div className="mb-4">
                <div className="text-sm font-semibold tracking-wide text-foreground/95">Application</div>
                <div className="mt-1 text-sm text-foreground/75">
                  Apply in under 2 minutes. Most applicants hear back within 1 business day.
                </div>
              </div>
              <DriverApplicationForm />
            </div>
          </div>

          <div className="mt-14 rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {faqs.map((f) => (
                <CollapsibleFAQ key={f.question} question={f.question} answer={f.answer} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Prefer to talk first? Reach out and we’ll point you in the right direction.
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
