import clientPromise from "@/lib/mongodb";
import { LeaseSignForm } from "@/components/lease/lease-sign-form";
import { SITE_CONFIG } from "@/lib/site-config";

/**
 * /lease/sign?t=<signingToken>
 *
 * The other end of the "send me the agreement to review before I sign" deferral.
 * The token is minted per lease record in /api/onboarding/complete and emailed by
 * sendLeaseAgreementForReview(); it is a capability, exactly like the onboarding
 * session token — holding it proves you are the applicant it was mailed to.
 *
 * Deliberately NOT the onboarding portal: that session is closed on submission
 * (which is the funnel fix — a submitted application must read as submitted), and
 * reopening it would put a finished applicant back into a 7-step wizard to change
 * one field.
 */

export const metadata = {
  title: "Lease-On Agreement | Twin Mile LLC",
  description: "Review and electronically sign your Twin Mile Lease-On Agreement.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>
    </main>
  );
}

function DeadEnd({ message }: { message: string }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-lg">
        <h1 className="text-xl font-semibold">Agreement link</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${SITE_CONFIG.email}`}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Email Twin Mile
          </a>
          <a
            href={`tel:${SITE_CONFIG.phoneRaw}`}
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Call {SITE_CONFIG.phone}
          </a>
        </div>
      </div>
    </Shell>
  );
}

export default async function LeaseSignPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = (t || "").trim();

  if (!token) {
    return (
      <DeadEnd message="This page needs the personal link from your agreement email. Open that email and tap “Review and sign”." />
    );
  }
  if (!clientPromise) {
    return <DeadEnd message="We cannot load your agreement right now. Please try again shortly." />;
  }

  const client = await clientPromise;
  const lease = await client.db().collection("lease_agreements").findOne({ signingToken: token });

  if (!lease) {
    return (
      <DeadEnd message="This signing link is not valid. Reply to your agreement email and we will send a fresh one." />
    );
  }

  // Already signed is a SUCCESS state, not an error — a person who taps the
  // emailed link twice must not be told something went wrong.
  if (lease.status !== "awaiting_signature" || lease.signature) {
    return (
      <DeadEnd message="This agreement is already signed and with Twin Mile for review. Nothing more is needed from you." />
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your Lease-On Agreement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {String(lease.operatorName || "")} · {SITE_CONFIG.companyName} · {SITE_CONFIG.mcNumber}
        </p>
      </div>
      <LeaseSignForm token={token} operatorName={String(lease.operatorName || "")} />
    </Shell>
  );
}
