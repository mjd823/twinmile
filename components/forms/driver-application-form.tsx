"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitDriverApplicationAction } from "@/app/actions/public";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function DriverApplicationForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

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
        <label className="text-sm font-medium" htmlFor="fullName">
          Full name
        </label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
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
          <label className="text-sm font-medium" htmlFor="truckType">
            Truck / trailer type
          </label>
          <Input
            id="truckType"
            name="truckType"
            placeholder="26ft box • Hotshot • Semi • Sprinter…"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="yearsExperience">
            Years experience (optional)
          </label>
          <Input id="yearsExperience" name="yearsExperience" placeholder="e.g. 3" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="preferredRoutes">
            Preferred routes (optional)
          </label>
          <Input id="preferredRoutes" name="preferredRoutes" placeholder="TX/LA • Regional • OTR…" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="startDate">
            Start date (optional)
          </label>
          <Input id="startDate" name="startDate" placeholder="ASAP" />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="notes">
          Notes (optional)
        </label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Tell us about your equipment, endorsements, availability…"
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
        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
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
