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
        <label className="text-sm font-medium" htmlFor="name">
          Name
        </label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="company">
          Company (optional)
        </label>
        <Input id="company" name="company" autoComplete="organization" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="phone">
            Phone
          </label>
          <Input id="phone" name="phone" autoComplete="tel" required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="pickupLocation">
            Pickup location
          </label>
          <Input id="pickupLocation" name="pickupLocation" required />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="dropoffLocation">
            Dropoff location
          </label>
          <Input id="dropoffLocation" name="dropoffLocation" required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="serviceType">
            Service type
          </label>
          <Input
            id="serviceType"
            name="serviceType"
            placeholder="Freight / Hotshot / Last‑mile / Dispatch / 3PL"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="pickupDate">
            Pickup date (optional)
          </label>
          <Input id="pickupDate" name="pickupDate" placeholder="MM/DD/YYYY" />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="notes">
          Notes (optional)
        </label>
        <Textarea id="notes" name="notes" placeholder="Details, constraints, timelines…" />
      </div>

      <div className="hidden">
        <label htmlFor="hp">Leave this field blank</label>
        <Input id="hp" name="hp" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" disabled={status.state === "submitting"}>
        {status.state === "submitting" ? "Submitting…" : "Request Quote"}
      </Button>

      {status.state === "success" ? (
        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
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
