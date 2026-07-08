"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitDriverApplicationAction } from "@/app/actions/public";
import { captureUtm, getUtm } from "@/lib/utm";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function DriverApplicationForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });
  const fieldClassName =
    "h-10 border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 placeholder:text-xs transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";
  const areaClassName =
    "min-h-[108px] border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 placeholder:text-xs transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";

  React.useEffect(() => { captureUtm(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    const utm = getUtm();
    if (utm) payload.utm = utm;

    setStatus({ state: "submitting" });

    const result = await submitDriverApplicationAction(payload);

    if (!result.ok) {
      setStatus({ state: "error", message: result.error || "Something went wrong. Please try again." });
      return;
    }

    // Analytics event only — no PII. Lead scoring happens server-side.
    try {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'generate_lead', {
          event_category: 'form_submission',
          event_label: 'driver_application'
        });
      }
    } catch {
      // Analytics must never block the success state.
    }

    setStatus({ state: "success" });
    form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground/95" htmlFor="fullName">
          Full name
        </label>
        <Input id="fullName" name="fullName" autoComplete="name" className={fieldClassName} required />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" className={fieldClassName} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="phone">
            Phone
          </label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className={fieldClassName} required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="truckType">
            Truck / trailer type
          </label>
          <Input
            id="truckType"
            name="truckType"
            placeholder="26ft box • Hotshot • Semi"
            className={fieldClassName}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="yearsExperience">
            Years experience (optional)
          </label>
          <Input id="yearsExperience" name="yearsExperience" placeholder="2+" className={fieldClassName} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="preferredRoutes">
            Preferred routes (optional)
          </label>
          <Input id="preferredRoutes" name="preferredRoutes" placeholder="TX/LA • Regional • OTR" className={fieldClassName} />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="startDate">
            Start date (optional)
          </label>
          <Input id="startDate" name="startDate" placeholder="ASAP" className={fieldClassName} />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground/95" htmlFor="notes">
          Notes (optional)
        </label>
        <p className="text-xs text-muted-foreground">
          Owner-operators: mention your insurance coverage and operating authority — it speeds up onboarding.
        </p>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Equipment, endorsements, availability…"
          className={areaClassName}
        />
      </div>

      <div className="hidden">
        <label htmlFor="hp">Leave this field blank</label>
        <Input id="hp" name="hp" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" disabled={status.state === "submitting"}>
        {status.state === "submitting" ? "Submitting…" : "Apply to Drive"}
      </Button>

      {status.state === "success" ? (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-foreground/90">
          Thanks — we received your application. We’ll reach out shortly.
        </div>
      ) : null}

      {status.state === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message}
        </div>
      ) : null}
    </form>
  );
}
