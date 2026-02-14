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
    "h-10 border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";
  const areaClassName =
    "min-h-[108px] border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";

  React.useEffect(() => { captureUtm(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    const utm = getUtm();
    if (utm) payload.utm = utm;

    setStatus({ state: "submitting" });

    const result = await submitDriverApplicationAction(payload);
    if (!result.ok) {
      setStatus({ state: "error", message: result.error || "Something went wrong. Please try again." });
      return;
    }

    setStatus({ state: "success" });
    e.currentTarget.reset();
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
          <Input id="phone" name="phone" autoComplete="tel" className={fieldClassName} required />
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
            placeholder="26ft box • Hotshot • Semi • Sprinter…"
            className={fieldClassName}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="yearsExperience">
            Years experience (optional)
          </label>
          <Input id="yearsExperience" name="yearsExperience" placeholder="e.g. 3" className={fieldClassName} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="preferredRoutes">
            Preferred routes (optional)
          </label>
          <Input id="preferredRoutes" name="preferredRoutes" placeholder="TX/LA • Regional • OTR…" className={fieldClassName} />
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
        <Textarea
          id="notes"
          name="notes"
          placeholder="Tell us about your equipment, endorsements, availability…"
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
