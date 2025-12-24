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
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Drive With Us",
  description:
    "Owner-operators and drivers: apply to haul loads with Twin Mile LLC. Nationwide freight, hotshot, and last-mile opportunities.",
  alternates: { canonical: "/drive-with-us" },
};

export default function DriveWithUsPage() {
  const baseUrl = "https://twinmile.com";

  return (
    <main>
      <JsonLd
        data={[
          orgSchema(),
          localBusinessSchema(),
          breadcrumbSchema([
            { name: "Home", url: `${baseUrl}/` },
            { name: "Drive With Us", url: `${baseUrl}/drive-with-us` },
          ]),
          faqSchema(
            [
              {
                question: "Do you hire owner-operators with their own trucks?",
                answer:
                  "Yes. Twin Mile LLC is actively looking for reliable owner-operators with their own equipment to support time-critical freight nationwide.",
              },
              {
                question: "What routes do you run?",
                answer:
                  "We operate nationwide, with strong coverage across Texas, Louisiana, California, and beyond.",
              },
              {
                question: "How fast will you respond to an application?",
                answer:
                  "We aim to respond quickly. Submit the application and we’ll reach out as soon as possible.",
              },
            ],
            `${baseUrl}/drive-with-us`
          ),
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
              We’re looking for reliable drivers and owner-operators with their own trucks.
              Move fast. Stay professional. Get paid.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-5 py-14 md:py-20">
          <div className="mb-10 grid gap-6 md:grid-cols-3">
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
              <h2 className="text-xl font-semibold tracking-tight">Why Twin Mile</h2>
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

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="shadow-lg shadow-primary/20">
                  <Link href="#apply">Apply now</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/driver/login">Driver login</Link>
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
                  Apply in under 2 minutes — we’ll reach out as soon as possible.
                </div>
              </div>
              <DriverApplicationForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
