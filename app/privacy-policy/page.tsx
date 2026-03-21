import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const metadata: Metadata = {
  title: "Privacy Policy | Twin Mile LLC",
  description:
    "Privacy Policy for Twin Mile LLC. Learn how we collect, use, and protect your personal information.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 14, 2026";

  return (
    <main>
      <div className="mx-auto w-full max-w-4xl px-5 py-6">
        <Breadcrumbs items={[{ label: "Privacy Policy" }]} />
      </div>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-4xl px-5 py-14 md:py-20">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Privacy Policy</h1>
          <p className="mt-4 text-base text-foreground/85 md:text-lg">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-4xl px-5 py-14 md:py-20">
          <div className="prose prose-sm prose-invert max-w-none text-foreground/85 leading-relaxed space-y-8">
            {/* Introduction */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Introduction</h2>
              <p>
                Twin Mile LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects
                your privacy and is committed to protecting the personal information you share with
                us. This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you visit our website at{" "}
                <a href="https://twinmile.com" className="text-primary hover:underline">
                  twinmile.com
                </a>{" "}
                and use our services.
              </p>
            </div>

            {/* Information We Collect */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Information We Collect
              </h2>
              <p>We may collect the following types of information:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80 mt-3">
                <li>
                  <strong>Personal Information:</strong> Name, email address, phone number, mailing
                  address, and other contact details you provide when submitting forms (quote
                  requests, driver applications, lease agreements).
                </li>
                <li>
                  <strong>Business Information:</strong> Company name, MC number, DOT number,
                  equipment details, insurance information, and other business-related data relevant
                  to our logistics services.
                </li>
                <li>
                  <strong>Documents:</strong> Driver&rsquo;s license, CDL, certificates of
                  insurance, vehicle registration, W-9 forms, DOT physicals, and other documents
                  submitted through our lease-on agreement process.
                </li>
                <li>
                  <strong>Usage Data:</strong> IP address, browser type, pages visited, time spent on
                  pages, and other analytics data collected automatically through cookies and similar
                  technologies.
                </li>
                <li>
                  <strong>Communication Data:</strong> Records of communications between you and Twin
                  Mile LLC, including emails, phone calls, and text messages.
                </li>
              </ul>
            </div>

            {/* How We Use Your Information */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                How We Use Your Information
              </h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80 mt-3">
                <li>Process and respond to your inquiries, quote requests, and applications.</li>
                <li>
                  Facilitate the lease-on agreement process and onboarding of owner-operators.
                </li>
                <li>Provide, maintain, and improve our logistics and transportation services.</li>
                <li>
                  Communicate with you about your account, services, and business opportunities.
                </li>
                <li>Comply with legal and regulatory requirements, including FMCSA regulations.</li>
                <li>Protect against fraudulent or unauthorized activity.</li>
                <li>Analyze website usage to improve user experience.</li>
              </ul>
            </div>

            {/* SMS/Text Messaging Privacy — Vonage Requirement */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-3">
                SMS / Text Messaging Privacy
              </h2>
              <p>
                No mobile information will be shared with third parties/affiliates for
                marketing/promotional purposes. All OPT-IN requests include text messaging
                originator opt-in data and consent; this information will not be shared with third
                parties.
              </p>
              <p className="mt-3">
                If you opt in to receive text messages from Twin Mile LLC, you consent to receiving
                messages related to your service inquiries, driver applications, load updates, and
                operational communications. You may opt out at any time by replying STOP to any
                message. Message and data rates may apply. Message frequency varies.
              </p>
            </div>

            {/* Information Sharing */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Information Sharing and Disclosure
              </h2>
              <p>
                We do not sell your personal information. We may share your information in the
                following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80 mt-3">
                <li>
                  <strong>Service Providers:</strong> With trusted third-party service providers who
                  assist us in operating our business (e.g., payment processing, email services,
                  analytics), subject to confidentiality obligations.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law, regulation, or legal
                  process, or to protect the rights, property, or safety of Twin Mile LLC, our
                  users, or others.
                </li>
                <li>
                  <strong>Business Partners:</strong> With shippers, brokers, and other logistics
                  partners as necessary to facilitate transportation services you have requested.
                </li>
                <li>
                  <strong>Regulatory Agencies:</strong> With the FMCSA, DOT, or other regulatory
                  bodies as required for compliance with transportation regulations.
                </li>
              </ul>
            </div>

            {/* Data Security */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Security</h2>
              <p>
                We implement reasonable administrative, technical, and physical security measures to
                protect your personal information from unauthorized access, use, or disclosure.
                However, no method of transmission over the Internet or electronic storage is 100%
                secure, and we cannot guarantee absolute security.
              </p>
            </div>

            {/* Data Retention */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes
                for which it was collected, comply with legal obligations, resolve disputes, and
                enforce our agreements. Documents submitted as part of the lease-on agreement
                process are retained for the duration of the business relationship and as required
                by applicable regulations.
              </p>
            </div>

            {/* Your Rights */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/80 mt-3">
                <li>Access the personal information we hold about you.</li>
                <li>Request correction of inaccurate information.</li>
                <li>Request deletion of your personal information.</li>
                <li>Opt out of marketing communications.</li>
                <li>Opt out of text message communications by replying STOP.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please contact us at{" "}
                <a
                  href="mailto:admin@twinmile.com"
                  className="text-primary hover:underline"
                >
                  admin@twinmile.com
                </a>{" "}
                or call{" "}
                <a href="tel:+12817107787" className="text-primary hover:underline">
                  (281) 710-7787
                </a>
                .
              </p>
            </div>

            {/* Cookies */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Cookies and Tracking Technologies
              </h2>
              <p>
                We may use cookies, web beacons, and similar technologies to collect usage data and
                improve your experience on our website. You can control cookie preferences through
                your browser settings.
              </p>
            </div>

            {/* Children's Privacy */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Children&rsquo;s Privacy
              </h2>
              <p>
                Our services are not directed to individuals under the age of 18. We do not
                knowingly collect personal information from children. If we become aware that we
                have collected information from a child, we will take steps to delete it promptly.
              </p>
            </div>

            {/* Changes */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the updated policy on this page with a revised
                &ldquo;Last updated&rdquo; date. We encourage you to review this policy
                periodically.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <div className="mt-3 rounded-lg border border-border/60 bg-card/30 p-4 text-sm space-y-1">
                <div>
                  <strong>Twin Mile LLC</strong>
                </div>
                <div>Houston, TX 77002</div>
                <div>
                  Email:{" "}
                  <a
                    href="mailto:admin@twinmile.com"
                    className="text-primary hover:underline"
                  >
                    admin@twinmile.com
                  </a>
                </div>
                <div>
                  Phone:{" "}
                  <a href="tel:+12817107787" className="text-primary hover:underline">
                    (281) 710-7787
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
