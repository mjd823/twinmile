import {
  LEASE_FEES,
  LEASE_PAYMENT_SCHEDULE,
  LEASE_PENALTIES,
  LEASE_REQUIREMENTS,
  LEASE_SECTIONS,
  LEASE_TOTAL_FEE,
  leasePreamble,
} from "@/lib/lease-terms";

/**
 * The Lease-On Agreement rendered for the web, from lib/lease-terms.ts.
 *
 * Shared by the in-flow e-sign step (components/onboarding/OnboardingPortal.tsx)
 * and the standalone signing page (app/lease/sign). Both must show the same terms
 * as the emailed copy — a lease whose three surfaces disagree is not a lease.
 * Nothing here restates a figure; every number comes from the data module.
 *
 * Split into summary + full so each caller can put its own "read the full
 * agreement" toggle between them.
 */

export function LeaseTermsSummary() {
  return (
    <>
      {/* Summary Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-border/60 bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Payment Structure</p>
          <div className="text-sm space-y-1">
            {LEASE_FEES.map((f) => (
              <div key={f.label} className="flex justify-between">
                <span>{f.label}:</span> <strong>{f.value}</strong>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="font-semibold">Total Sign-On:</span>{" "}
              <strong className="text-primary">{LEASE_TOTAL_FEE}</strong>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{LEASE_PAYMENT_SCHEDULE}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Requirements</p>
          <div className="text-xs space-y-1 text-muted-foreground">
            {LEASE_REQUIREMENTS.map((r) => (
              <div key={r}>• {r}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Penalties Warning */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase mb-2">
          ⚠ Penalties &amp; Termination
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-muted-foreground">
          {LEASE_PENALTIES.map((p) => (
            <div key={p}>• {p}</div>
          ))}
        </div>
      </div>
    </>
  );
}

export function LeaseFullAgreement({ operatorName }: { operatorName: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-4 max-h-80 overflow-y-auto text-sm space-y-3">
      <p className="font-semibold">{leasePreamble(operatorName)}</p>
      {LEASE_SECTIONS.map((s) => (
        <div key={s.n}>
          <p className="font-semibold mb-1">
            {s.n}. {s.title}
          </p>
          <p className="text-xs text-muted-foreground">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
