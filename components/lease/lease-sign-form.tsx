"use client";

import * as React from "react";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeaseFullAgreement, LeaseTermsSummary } from "@/components/lease/lease-terms-view";

/**
 * Signing surface for an applicant who deferred the lease during onboarding.
 *
 * Deliberately the SAME shape as the in-flow e-sign step: same terms component,
 * same typed-name signature, same consent sentence. Someone who read the emailed
 * copy on his phone and then opened this link must not be shown a different
 * agreement than the one he read.
 */
export function LeaseSignForm({
  token,
  operatorName,
}: {
  token: string;
  operatorName: string;
}) {
  const [signature, setSignature] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [showFull, setShowFull] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const canSign = signature.trim().length > 1 && consent && state === "idle";

  async function submit() {
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/lease/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signature: signature.trim(), consent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "We could not record your signature.");
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not record your signature.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-lg">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-green-500" />
        <h2 className="text-xl font-semibold">Signed. Thank you.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your Lease-On Agreement is recorded and your application is with Twin Mile for review.
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = "/driver/login")}>
          Go to Driver Portal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Lease-On Agreement</h2>
          <Badge variant="secondary" className="text-xs">
            MC-1790263
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          You asked to review this before signing. Nothing is signed until you type your name below.
        </p>

        <LeaseTermsSummary />

        <button
          onClick={() => setShowFull(!showFull)}
          className="mb-3 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {showFull ? "Hide" : "Read"} full 8-section agreement
          <ChevronRight className={`h-3 w-3 transition-transform ${showFull ? "rotate-90" : ""}`} />
        </button>

        {showFull && <LeaseFullAgreement operatorName={operatorName} />}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium" htmlFor="lease-signature">
          Your Signature (type full legal name)
        </label>
        <Input
          id="lease-signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Type your full legal name to sign"
          className="font-medium"
        />
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="lease-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border/80 text-primary focus:ring-primary"
          />
          <label htmlFor="lease-consent" className="text-sm leading-relaxed">
            I agree to all terms above and provide my electronic signature. I certify the information provided is
            accurate and I authorize Twin Mile LLC to verify my credentials.
          </label>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Button size="lg" disabled={!canSign} onClick={submit}>
          {state === "submitting" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing…
            </>
          ) : (
            "Sign the agreement"
          )}
        </Button>
      </div>
    </div>
  );
}
