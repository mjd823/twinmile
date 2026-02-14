"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitDriverApplicationAction } from "@/app/actions/public";
import { captureUtm, getUtm } from "@/lib/utm";
import { analytics } from "@/lib/analytics";
import { aiEnhancedLeadManager } from "@/lib/ai-enhanced-lead-manager";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success" }
  | { state: "error"; message: string };

export function DriverApplicationForm() {
  const [status, setStatus] = React.useState<Status>({ state: "idle" });
  const [showTooltip, setShowTooltip] = React.useState(false);
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

    // Track successful driver application with business intelligence
    const formPayload = Object.fromEntries(formData.entries());
    const utmData = getUtm();
    
    analytics.trackDriverApplication({
      truckType: formPayload.truckType as string || 'dry_van',
      yearsExperience: formPayload.yearsExperience as string || '0',
      preferredRoutes: formPayload.preferredRoutes as string || '',
      startDate: formPayload.startDate as string || '',
      hasOwnAuthority: formPayload.hasOwnAuthority === 'true',
      utmSource: utmData?.utm_source,
      utmMedium: utmData?.utm_medium,
    });

    // Process driver lead with AI intelligence (this is the MAGIC!)
    const leadData = {
      id: `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'driver' as const,
      name: formPayload.fullName as string,
      email: formPayload.email as string,
      phone: formPayload.phone as string,
      truckType: formPayload.truckType as string,
      yearsExperience: formPayload.yearsExperience as string,
      hasOwnAuthority: formPayload.hasOwnAuthority === 'true',
      utmSource: utmData?.utm_source,
      utmMedium: utmData?.utm_medium,
      timestamp: new Date().toISOString(),
    };

    // Process with AI-enhanced intelligence
    const leadScore = await aiEnhancedLeadManager.processIncomingLead(leadData);
    
    console.log('🤖 AI Agent processed driver lead:', {
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
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-foreground/95" htmlFor="notes">
            Notes (optional)
          </label>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute left-6 top-0 z-10 w-64 rounded-lg border border-border/60 bg-popover p-3 text-xs text-foreground shadow-lg">
                <div className="font-medium text-primary">Owner-operators:</div>
                <div className="mt-1 text-muted-foreground">
                  If you're an owner-operator, please mention your insurance coverage and operating authority. This helps expedite onboarding for all applicants.
                </div>
                <div className="absolute -left-2 top-2 h-0 w-0 border-t-4 border-r-4 border-b-4 border-l-0 border-transparent border-r-popover"></div>
              </div>
            )}
          </div>
        </div>
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
