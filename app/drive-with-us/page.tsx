import type { Metadata } from "next";

import Link from "next/link";
import { DriverApplicationForm } from "@/components/forms/driver-application-form";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import {
  breadcrumbSchema,
  faqSchema,
  localBusinessSchema,
  orgSchema,
  webSiteSchema,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Drive With Us",
  description:
    "Owner-operators and drivers: apply to haul loads with Twin Mile LLC. Nationwide freight, hotshot, and last-mile opportunities.",
  alternates: { canonical: "/drive-with-us" },
};

export default function DriveWithUsPage() {
  const baseUrl = "https://twinmile.com";

  const faqs = [
    {
      question: "How does the application work?",
      answer:
        "Submit the short application, then our team reviews it and reaches out for a quick call/text to confirm availability, equipment, and lanes. If it’s a fit, we’ll guide you through onboarding and dispatch." ,
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
        "We operate nationwide, with strong coverage across Texas, Louisiana, California, and beyond. We’ll match lanes based on your availability and equipment.",
    },
    {
      question: "What do you need from me to get started?",
      answer:
        "At minimum: basic contact info, your equipment type, and your availability. If we move forward, we’ll request standard onboarding documents and insurance details (owner-operators).",
    },
    {
      question: "Is this a W-2 role or 1099/owner-operator?",
      answer:
        "We support owner-operators and contractors. If you’re applying as a company driver, mention it in the notes and we’ll confirm options based on current openings.",
    },
  ];

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          webSiteSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Drive With Us", url: `${baseUrl}/drive-with-us` },
          ]),
          faqSchema(faqs, `${baseUrl}/drive-with-us`),
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
              Owner-operators & drivers • Nationwide lanes
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">Drive With Us</h1>
            <p className="mt-4 text-muted-foreground">
              Apply in minutes. We’ll review and reach out with next steps.
              Owner-operators and professional drivers — nationwide lanes.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="mb-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Owner-operators</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-primary">80% Gross</div>
              <div className="mt-2 text-sm text-muted-foreground">To the truck. Competitive pay, transparent settlement.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Communication</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Clear</div>
              <div className="mt-2 text-sm text-muted-foreground">Professional expectations and tight updates.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Lanes</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Nationwide</div>
              <div className="mt-2 text-sm text-muted-foreground">Strong coverage across TX, LA, CA and beyond.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
              <div className="text-sm text-muted-foreground">Opportunity</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">Time‑critical</div>
              <div className="mt-2 text-sm text-muted-foreground">High‑priority loads and dedicated routes.</div>
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-xs font-semibold text-foreground/80">01 · Apply</div>
                  <div className="mt-1">Submit the short form with your contact info, equipment, and availability.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-xs font-semibold text-foreground/80">02 · Review</div>
                  <div className="mt-1">We review your application and match it against current lanes and freight needs.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-xs font-semibold text-foreground/80">03 · Confirm</div>
                  <div className="mt-1">Quick call/text to confirm equipment, routes, and expectations.</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground backdrop-blur">
                  <div className="text-xs font-semibold text-foreground/80">04 · Onboard</div>
                  <div className="mt-1">If it’s a fit, we’ll guide you through onboarding and get you dispatched.</div>
                </div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">Why Twin Mile</h2>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div>Clear communication.</div>
                <div>Time-critical freight opportunities.</div>
                <div>Dedicated routes and high-priority loads.</div>
                <div>Nationwide lanes (TX, LA, CA and beyond).</div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">What we need</h2>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div>Owner-operators with their own equipment.</div>
                <div>Professional, on-time performance.</div>
                <div>Safety-first mindset.</div>
              </div>

              <h2 className="mt-10 text-xl font-semibold tracking-tight">Before you apply</h2>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div>Have your equipment type and availability ready.</div>
                <div>Be specific about preferred lanes and start date (ASAP is fine).</div>
                <div>If you’re an owner-operator, mention your insurance and operating authority in notes (optional).</div>
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
              className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-xl shadow-black/20 backdrop-blur"
            >
              <div className="mb-4">
                <div className="text-sm font-medium">Application</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Apply in under 2 minutes. Most applicants hear back within 1 business day.
                </div>
              </div>
              <DriverApplicationForm />
            </div>
          </div>

          <div className="mt-14 rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {faqs.map((f) => (
                <div key={f.question} className="rounded-lg border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">{f.question}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{f.answer}</div>
                </div>
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
