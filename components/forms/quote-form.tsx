"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitQuoteLeadAction } from "@/app/actions/public";
import { captureUtm, getUtm } from "@/lib/utm";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function QuoteForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });
  const fieldClassName =
    "h-10 border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 focus-visible:ring-primary/60";
  const areaClassName =
    "min-h-[108px] border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 focus-visible:ring-primary/60";

  React.useEffect(() => { captureUtm(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    const utm = getUtm();
    if (utm) payload.utm = utm;

    setStatus({ state: "submitting" });

    const result = await submitQuoteLeadAction(payload);
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
        <label className="text-sm font-semibold text-foreground/95" htmlFor="name">
          Name
        </label>
        <Input id="name" name="name" autoComplete="name" className={fieldClassName} required />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground/95" htmlFor="company">
          Company (optional)
        </label>
        <Input id="company" name="company" autoComplete="organization" className={fieldClassName} />
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
          <label className="text-sm font-semibold text-foreground/95" htmlFor="pickupLocation">
            Pickup location
          </label>
          <Input id="pickupLocation" name="pickupLocation" className={fieldClassName} required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="dropoffLocation">
            Dropoff location
          </label>
          <Input id="dropoffLocation" name="dropoffLocation" className={fieldClassName} required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="serviceType">
            Service type
          </label>
          <Input
            id="serviceType"
            name="serviceType"
            placeholder="Freight / Hotshot / Last‑mile / Dispatch / 3PL"
            className={fieldClassName}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="pickupDate">
            Pickup date (optional)
          </label>
          <Input id="pickupDate" name="pickupDate" placeholder="MM/DD/YYYY" className={fieldClassName} />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground/95" htmlFor="notes">
          Notes (optional)
        </label>
        <Textarea id="notes" name="notes" placeholder="Details, constraints, timelines…" className={areaClassName} />
      </div>

      <div className="hidden">
        <label htmlFor="hp">Leave this field blank</label>
        <Input id="hp" name="hp" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" disabled={status.state === "submitting"}>
        {status.state === "submitting" ? "Submitting…" : "Request Quote"}
      </Button>

      {status.state === "success" ? (
        <div className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-foreground/90">
          Thanks — we received your request. We’ll reach out shortly.
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
