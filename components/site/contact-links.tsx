"use client";

import { analytics } from "@/lib/analytics";

export function ContactLinks() {
  return (
    <div className="mt-2 grid gap-1 text-sm">
      <a
        href="tel:+12817107787"
        className="text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => analytics.trackPhoneCall('+12817107787', 'footer')}
      >
        (281) 710-7787
      </a>
      <a
        href="mailto:admin@twinmile.com"
        className="text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => analytics.trackEmailClick('admin@twinmile.com', 'footer')}
      >
        admin@twinmile.com
      </a>
    </div>
  );
}
