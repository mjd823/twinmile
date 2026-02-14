"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitQuoteLeadAction } from "@/app/actions/public";
import { captureUtm, getUtm } from "@/lib/utm";
import { analytics } from "@/lib/analytics";
import { aiEnhancedLeadManager } from "@/lib/ai-enhanced-lead-manager";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function QuoteForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });
  const fieldClassName =
    "h-10 border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";
  const selectClassName =
    "h-10 w-full rounded-md border border-border/80 bg-background/70 px-3 text-sm text-foreground shadow-sm shadow-black/10 transition-colors transition-shadow focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";
  const areaClassName =
    "min-h-[108px] border-border/80 bg-background/70 text-foreground placeholder:text-foreground/55 transition-shadow focus-visible:border-primary/60 focus-visible:ring-primary/70 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]";

  React.useEffect(() => { captureUtm(); }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    const utm = getUtm();
    if (utm) payload.utm = utm;

    setStatus({ state: "submitting" });

    const result = await submitQuoteLeadAction(payload);
    if (!result.ok) {
      setStatus({ state: "error", message: result.error || "Something went wrong. Please try again." });
      return;
    }

    // Track successful quote submission with business intelligence
    const formPayload = Object.fromEntries(formData.entries());
    const utmData = getUtm();
    
    analytics.trackQuoteSubmission({
      serviceType: formPayload.serviceType as string || 'freight',
      pickupLocation: formPayload.pickupLocation as string || '',
      dropoffLocation: formPayload.dropoffLocation as string || undefined,
      contactMethod: 'email', // Default since form submission is email-based
      company: formPayload.company as string || undefined,
      utmSource: utmData?.utm_source,
      utmMedium: utmData?.utm_medium,
      utmCampaign: utmData?.utm_campaign,
    });

    // Process lead with AI intelligence (this is the MAGIC!)
    const leadData = {
      id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'quote' as const,
      name: formPayload.name as string,
      email: formPayload.email as string,
      serviceType: formPayload.serviceType as string,
      pickupLocation: formPayload.pickupLocation as string,
      dropoffLocation: formPayload.dropoffLocation as string,
      company: formPayload.company as string,
      utmSource: utmData?.utm_source,
      utmMedium: utmData?.utm_medium,
      utmCampaign: utmData?.utm_campaign,
      timestamp: new Date().toISOString(),
    };

    // Process with AI-enhanced intelligence
    const leadScore = await aiEnhancedLeadManager.processIncomingLead(leadData);
    
    console.log('🤖 AI Agent processed lead:', {
      score: leadScore.score,
      quality: leadScore.quality,
      value: leadScore.estimatedValue,
      priority: leadScore.priority,
      autoActions: leadScore.autoActions,
      assignee: leadScore.routing.assignee,
      aiInsights: leadScore.aiAnalysis?.insights || [],
      aiRecommendations: leadScore.aiAnalysis?.recommendations || [],
      processingMethod: leadScore.processingMethod
    });

    setStatus({ state: "success" });
    form.reset();
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
          <select id="serviceType" name="serviceType" className={selectClassName} defaultValue="" required>
            <option value="" disabled>
              Select a service
            </option>
            <option value="Freight Transportation">Freight Transportation</option>
            <option value="Hotshot Trucking">Hotshot Trucking</option>
            <option value="Last-mile delivery">Last-mile delivery</option>
            <option value="Dispatching">Dispatching</option>
            <option value="3PL">3PL</option>
            <option value="Other">Other</option>
          </select>
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
