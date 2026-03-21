import type { Metadata } from "next";

import { LeaseAgreementForm } from "@/components/forms/lease-agreement-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = {
  title: "Lease-On Agreement | Twin Mile LLC",
  description:
    "Owner-Operator Lease-On Agreement for Twin Mile LLC. Review the terms and submit your documents to lease on under our MC authority.",
  robots: { index: false, follow: false },
};

export default function LeaseAgreementPage() {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main>
      <div className="mx-auto w-full max-w-4xl px-5 py-6">
        <Breadcrumbs items={[{ label: "Lease-On Agreement" }]} />
      </div>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-4xl px-5 py-14 md:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Owner-Operator Agreement
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              Lease-On Agreement
            </h1>
            <p className="mt-4 text-base text-foreground/85 md:text-lg">
              Review the agreement below and submit your documents to get started with Twin Mile
              LLC.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-4xl px-5 py-14 md:py-20">
          {/* Agreement Text */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-6 md:p-10 backdrop-blur mb-10">
            <h2 className="text-2xl font-semibold tracking-tight text-center mb-2">
              LEASE-ON AGREEMENT
            </h2>
            <div className="prose prose-sm prose-invert max-w-none text-foreground/85 leading-relaxed">
              <p>
                This Lease-On Agreement (&ldquo;Agreement&rdquo;) is made and entered into as of{" "}
                <strong>{today}</strong>, by and between{" "}
                <strong>Twin Mile LLC</strong>, with its principal place of business at Houston, TX
                77002 (&ldquo;Carrier&rdquo;), and [Owner-Operator Name/Company Name], with its
                principal place of business at [Address] (&ldquo;Owner-Operator&rdquo;).
              </p>

              <h3 className="text-lg font-semibold mt-8 mb-3">Recitals</h3>
              <p>
                WHEREAS, Carrier is a duly authorized motor carrier holding operating authority from
                the Federal Motor Carrier Safety Administration (&ldquo;FMCSA&rdquo;) under MC
                Number <strong>MC1790263</strong>; and
              </p>
              <p>
                WHEREAS, Owner-Operator possesses certain motor vehicles and equipment suitable for
                the transportation of property in interstate commerce; and
              </p>
              <p>
                WHEREAS, Carrier desires to lease the Owner-Operator&rsquo;s vehicle(s) and services
                for the transportation of goods under Carrier&rsquo;s operating authority; and
              </p>
              <p>
                WHEREAS, Owner-Operator desires to lease its vehicle(s) and services to Carrier,
                subject to the terms and conditions set forth herein.
              </p>
              <p>
                NOW, THEREFORE, in consideration of the mutual covenants and agreements contained
                herein, the parties agree as follows:
              </p>

              {/* Section 1 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">1. Purpose of Agreement</h3>
              <p>
                <strong>1.1. Lease of Services and Equipment:</strong> Carrier hereby leases from
                Owner-Operator, and Owner-Operator hereby leases to Carrier, the exclusive use of
                the Owner-Operator&rsquo;s vehicle(s) and services for the transportation of
                property in interstate commerce, subject to the terms and conditions of this
                Agreement.
              </p>
              <p>
                <strong>1.2. Operating Authority:</strong> The transportation services provided by
                Owner-Operator under this Agreement shall be conducted under the operating authority
                of Carrier, as granted by the FMCSA.
              </p>

              {/* Section 2 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">2. Term of Agreement</h3>
              <p>
                <strong>2.1. Commencement and Duration:</strong> This Agreement shall commence on
                the date signed and shall continue, unless earlier terminated as provided herein.
              </p>
              <p>
                <strong>2.2. Renewal:</strong> This Agreement may be renewed upon the written
                agreement of both parties, specifying the terms and duration of the renewal.
              </p>
              <p>
                <strong>2.3. Termination Notice:</strong> Either party may terminate this Agreement
                by providing seven (7) days&rsquo; written notice to the other party, subject to the
                termination provisions herein.
              </p>

              {/* Section 3 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">
                3. Requirements and Compliance
              </h3>
              <p>
                <strong>3.1. DOT Compliance:</strong> Owner-Operator represents and warrants that it
                shall:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  Provide and maintain a valid and current DOT Medical Examiner&rsquo;s Certificate
                  (DOT Physical).
                </li>
                <li>
                  Provide and maintain proof of an up-to-date annual DOT truck inspection, conducted
                  in accordance with FMCSA regulations.
                </li>
                <li>
                  Maintain a valid Commercial Driver&rsquo;s License (CDL) with all necessary
                  endorsements.
                </li>
                <li>
                  Comply with all applicable DOT and FMCSA regulations, including but not limited to
                  Hours of Service (HOS), vehicle maintenance, and safety requirements.
                </li>
                <li>
                  Maintain and utilize a functioning Electronic Logging Device (ELD) that complies
                  with FMCSA regulations.
                </li>
                <li>
                  Provide a current Motor Vehicle Record (MVR) upon request and maintain a driving
                  record that meets Carrier&rsquo;s safety standards.
                </li>
                <li>
                  Immediately report any traffic violations, accidents, or other incidents to
                  Carrier.
                </li>
              </ul>

              <p className="mt-4">
                <strong>3.2. Insurance:</strong> Owner-Operator shall:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  Maintain valid insurance coverage that meets or exceeds the minimum requirements of
                  the FMCSA, with Twin Mile LLC listed as a certificate holder.
                </li>
                <li>
                  Provide proof of active insurance coverage to Carrier monthly or upon request.
                </li>
                <li>
                  Acknowledge and agree that Owner-Operator&rsquo;s insurance coverage shall be the
                  primary insurance in the event of any accident or claim.
                </li>
              </ul>

              <p className="mt-4">
                <strong>3.3. Vehicle and Equipment:</strong> Owner-Operator shall:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  Provide a detailed description of the vehicle(s) being leased, including make,
                  model, year, Vehicle Identification Number (VIN), and any installed equipment.
                </li>
                <li>
                  Be solely responsible for the maintenance, repair, and upkeep of the vehicle(s) to
                  ensure compliance with all safety and operational standards.
                </li>
                <li>
                  Ensure that the vehicle(s) and equipment are in good working condition and meet all
                  applicable safety requirements.
                </li>
              </ul>

              {/* Section 4 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">4. Financial Terms</h3>
              <p>
                <strong>4.1. Payment Structure:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  <strong>MC Usage Fee:</strong> 10% of the gross revenue generated from each load
                  transported under Carrier&rsquo;s MC number.
                </li>
                <li>
                  <strong>Factoring Fee:</strong> 3% of the gross revenue for factoring services
                  provided by Carrier.
                </li>
                <li>
                  <strong>Dispatching Fee:</strong> 7% of the gross revenue for dispatching services
                  provided by Carrier.
                </li>
                <li>
                  <strong>Sign-On Fee:</strong> A total of 20% of the gross revenue, encompassing
                  the aforementioned fees.
                </li>
                <li>
                  <strong>Payment Schedule:</strong> Invoices paid by factoring shall be paid out to
                  Owner-Operator by Tuesday of the following week.
                </li>
                <li>
                  <strong>Expedited Payment:</strong> Requests for expedited payment may be
                  accommodated, subject to a fee to be determined (TBD) based on the specific
                  circumstances and Carrier&rsquo;s discretion.
                </li>
              </ul>

              <p className="mt-4">
                <strong>4.2. Penalties and Fines:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  <strong>Failed DOT Inspection:</strong> A $1,000 fine for any failed DOT
                  inspection, resulting in automatic termination of this Agreement.
                </li>
                <li>
                  <strong>Failure to Report DOT Inspection:</strong> A $1,000 fine for failing to
                  report a DOT inspection within 24 hours.
                </li>
                <li>
                  <strong>Unauthorized MC Number Use:</strong> A $1,000 fine for any unauthorized
                  use of Carrier&rsquo;s DOT/MC number, resulting in automatic termination of this
                  Agreement and reporting to FMCSA.
                </li>
                <li>
                  <strong>Driver Change Notification:</strong> A $500 fine for any driver change
                  without prior written notification to Carrier, resulting in termination of this
                  Agreement.
                </li>
                <li>
                  <strong>Double Brokering:</strong> A $2,000 fine for any instance of double
                  brokering, resulting in termination of this Agreement and reporting to FMCSA.
                </li>
              </ul>

              {/* Section 5 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">5. Liability and Insurance</h3>
              <p>
                <strong>5.1. Accident Liability:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  In the event of an accident, Owner-Operator&rsquo;s insurance coverage shall be
                  the primary insurance.
                </li>
                <li>
                  An &ldquo;at-fault&rdquo; accident, as determined by law enforcement, insurance
                  investigation, or Carrier&rsquo;s internal investigation, may result in immediate
                  termination of this Agreement at Carrier&rsquo;s sole discretion.
                </li>
              </ul>

              <p className="mt-4">
                <strong>5.2. Indemnification:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80">
                <li>
                  Owner-Operator shall indemnify, defend, and hold harmless Carrier from any and all
                  claims, losses, damages, liabilities, and expenses arising from
                  Owner-Operator&rsquo;s negligence, misconduct, or breach of this Agreement.
                </li>
                <li>
                  Carrier shall indemnify, defend, and hold harmless Owner-Operator from any and all
                  claims, losses, damages, liabilities, and expenses arising from Carrier&rsquo;s
                  negligence, misconduct, or breach of this Agreement.
                </li>
              </ul>

              {/* Section 6 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">6. Termination Clause</h3>
              <p>
                <strong>6.1. Material Breach:</strong> This Agreement may be terminated by either
                party upon written notice of a material breach of this Agreement by the other party,
                which remains uncured for seven (7) days after such notice.
              </p>
              <p>
                <strong>6.2. Automatic Termination:</strong> This Agreement shall automatically
                terminate upon the occurrence of any of the violations specified in Section 4.2.
              </p>
              <p>
                <strong>6.3. Discretionary Termination:</strong> Carrier may terminate this
                Agreement at its sole discretion in the event of an at-fault accident by the
                Owner-Operator.
              </p>
              <p>
                <strong>6.4. Notice Termination:</strong> Either party may terminate this Agreement
                by providing seven (7) days&rsquo; written notice to the other party.
              </p>

              {/* Section 7 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">7. Dispute Resolution</h3>
              <p>
                Any dispute, controversy, or claim arising out of or relating to this Agreement
                shall be resolved through Harris County in accordance with the laws of the State of
                Texas.
              </p>

              {/* Section 8 */}
              <h3 className="text-lg font-semibold mt-8 mb-3">8. Miscellaneous Provisions</h3>
              <p>
                <strong>8.1. Governing Law:</strong> This Agreement shall be governed by and
                construed in accordance with the laws of the State of Texas.
              </p>
              <p>
                <strong>8.2. Entire Agreement:</strong> This Agreement constitutes the entire
                agreement between the parties and supersedes all prior agreements and
                understandings, whether written or oral.
              </p>
              <p>
                <strong>8.3. Amendment:</strong> This Agreement may not be amended except in writing
                signed by both parties.
              </p>
              <p>
                <strong>8.4. Severability:</strong> If any provision of this Agreement is held to be
                invalid or unenforceable, the remaining provisions shall continue in full force and
                effect.
              </p>
              <p>
                <strong>8.5. Notices:</strong> All notices required or permitted under this Agreement
                shall be in writing and shall be deemed to have been duly given when delivered
                personally, sent by certified mail, or sent by reputable overnight courier to the
                addresses set forth herein.
              </p>

              <p className="mt-8 font-medium text-foreground">
                The Parties agree to the terms and conditions set forth above as demonstrated by
                their signatures as follows:
              </p>
            </div>
          </div>

          {/* Submission Form */}
          <div
            id="sign"
            className="rounded-xl border border-primary/25 bg-card/55 p-6 md:p-8 shadow-xl shadow-black/20 backdrop-blur"
          >
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">
                Sign &amp; Submit Agreement
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your required documents and fill in your information below. All fields marked
                with <span className="text-destructive">*</span> are required.
              </p>
            </div>
            <LeaseAgreementForm />
          </div>
        </div>
      </section>
    </main>
  );
}
