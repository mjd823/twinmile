/**
 * Outreach email templates + renderer.
 *
 * Extracted from app/api/cron/process-outreach/route.ts so the admin outreach
 * dashboard can re-render what a legacy task (sent before renderedSubject/
 * renderedBody were persisted) would have said. Templates are deterministic
 * functions of (lead, personalization); going forward the cron route persists
 * the exact rendered subject/body on each outreach_task at send time, and the
 * renderer is only a fallback for historical rows.
 */

// Leads come from heterogeneous collections (leads_quotes, leads_drivers,
// outbound_prospects) with different shapes -- same loose typing as the
// legacy script.
export type Lead = any;
export type Personalization = any;

export const EMAIL_TEMPLATES: Record<
  string,
  {
    subject: (lead: Lead) => string;
    html: (lead: Lead, p: Personalization) => string;
    text: (lead: Lead, p: Personalization) => string;
  }
> = {
  quote_initial: {
    subject: (lead) => `Your ${lead.serviceType || "freight"} quote request -- Twin Mile`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Thank you for requesting a quote for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nThank you for requesting a quote for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.`,
  },
  quote_followup: {
    subject: (lead) => `Following up: Your ${lead.serviceType || "freight"} quote`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Following up on your quote request for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nFollowing up on your quote request for ${lead.serviceType || "freight"} from ${lead.pickupLocation || "your location"} to ${lead.dropoffLocation || "destination"}.`,
  },
  driver_welcome: {
    subject: (lead) => `Welcome to Twin Mile -- Your ${lead.truckType || "driving"} application`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Thank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || "driving"}.</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nThank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || "driving"}.`,
  },
  driver_followup: {
    subject: () => `Next steps for your Twin Mile application`,
    html: (lead) =>
      `<p>Hi ${lead.name},</p><p>Following up on your application to drive with Twin Mile (${lead.truckType || "driving"}).</p>`,
    text: (lead) =>
      `Hi ${lead.name},\n\nFollowing up on your application to drive with Twin Mile (${lead.truckType || "driving"}).`,
  },
  prospect_outreach: {
    subject: (lead) => `${lead.name || "Your business"} — Drive with Twin Mile`,
    html: (lead, p) =>
      `<p>Hi ${p.name || lead.name},</p><p>We found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.</p><p><strong>Why Twin Mile?</strong></p><ul><li>Competitive pay per mile</li><li>Flexible scheduling</li><li>24/7 driver support</li></ul><p>Ready to learn more? <a href="https://twinmile.com/drive-with-us">Click here to get started</a> or reply to this email.</p><p>Best regards,<br/>Twin Mile Recruiting Team</p>`,
    text: (lead, p) =>
      `Hi ${p.name || lead.name},\n\nWe found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.\n\nWhy Twin Mile?\n- Competitive pay per mile\n- Flexible scheduling\n- 24/7 driver support\n\nReady to learn more? Visit https://twinmile.com/drive-with-us or reply to this email.\n\nBest regards,\nTwin Mile Recruiting Team`,
  },
  // Legacy laptop-era template name (June 2026 tasks) — a friendly follow-up
  // for prospects who were invited but haven't started onboarding.
  onboarding_followup: {
    subject: (lead) => `${lead.name || "Your carrier"} — your Twin Mile onboarding link is waiting`,
    html: (lead, p) =>
      `<p>Hi ${p?.name || lead.name || "there"},</p><p>Just checking in — we reached out about partnering with Twin Mile and your onboarding spot is still open.</p><p><strong>What you get as an owner-operator with us:</strong></p><ul><li>Competitive pay per mile</li><li>Flexible scheduling — you pick your lanes</li><li>24/7 driver support</li></ul><p>${p?.onboardingUrl ? `Start here (about 10 minutes): <a href="${p.onboardingUrl}">${p.onboardingUrl}</a>` : `Get started at <a href="https://twinmile.com/drive-with-us">twinmile.com/drive-with-us</a>`}</p><p>Questions about rates or lanes? Just reply to this email.</p><p>Best regards,<br/>Marcus Chen<br/>Twin Mile Recruiting Team</p>`,
    text: (lead, p) =>
      `Hi ${p?.name || lead.name || "there"},\n\nJust checking in — we reached out about partnering with Twin Mile and your onboarding spot is still open.\n\nWhat you get as an owner-operator with us:\n- Competitive pay per mile\n- Flexible scheduling — you pick your lanes\n- 24/7 driver support\n\n${p?.onboardingUrl ? `Start here (about 10 minutes): ${p.onboardingUrl}` : `Get started at https://twinmile.com/drive-with-us`}\n\nQuestions about rates or lanes? Just reply to this email.\n\nBest regards,\nMarcus Chen\nTwin Mile Recruiting Team`,
  },
};

export function renderOutreachEmail(
  templateName: string,
  lead: Lead,
  p: Personalization
): { subject: string; html: string; text: string } {
  const t = EMAIL_TEMPLATES[templateName];
  if (!t) throw new Error(`Unknown template: ${templateName}`);
  return { subject: t.subject(lead), html: t.html(lead, p), text: t.text(lead, p) };
}

/**
 * Deterministic suggested response to an inbound prospect reply.
 * Used by the resend-inbound webhook (OUTREACH_AUTOREPLY=draft|live) and shown
 * on /admin/outreach for one-click send. NOT AI-generated — same tone as the
 * prospect_outreach template, signed by Marcus Chen.
 */
export function renderReplyDraft(input: {
  name?: string | null;
  originalSubject?: string | null;
  onboardingUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const name = (input.name || "").trim() || "there";
  const baseSubject = (input.originalSubject || "").replace(/^(\s*re:\s*)+/i, "").trim();
  const subject = baseSubject ? `Re: ${baseSubject}` : "Re: Drive with Twin Mile";
  const linkLine = input.onboardingUrl
    ? `You can start your onboarding here (it takes about 10 minutes and saves your progress): ${input.onboardingUrl}`
    : `You can get started here: https://twinmile.com/drive-with-us`;
  const linkHtml = input.onboardingUrl
    ? `<p>You can start your onboarding here (it takes about 10 minutes and saves your progress):<br/><a href="${input.onboardingUrl}">${input.onboardingUrl}</a></p>`
    : `<p>You can get started at <a href="https://twinmile.com/drive-with-us">twinmile.com/drive-with-us</a>.</p>`;

  const text = `Hi ${name},\n\nThanks for getting back to us — great to hear from you.\n\nQuick recap of what partnering with Twin Mile looks like:\n- Competitive pay per mile\n- Flexible scheduling — you pick your lanes\n- 24/7 driver support\n\n${linkLine}\n\nIf you have questions about rates, lanes, or scheduling first, just reply to this email and I'll get you answers.\n\nBest regards,\nMarcus Chen\nTwin Mile Recruiting Team`;

  const html = `<p>Hi ${name},</p><p>Thanks for getting back to us — great to hear from you.</p><p><strong>Quick recap of what partnering with Twin Mile looks like:</strong></p><ul><li>Competitive pay per mile</li><li>Flexible scheduling — you pick your lanes</li><li>24/7 driver support</li></ul>${linkHtml}<p>If you have questions about rates, lanes, or scheduling first, just reply to this email and I'll get you answers.</p><p>Best regards,<br/>Marcus Chen<br/>Twin Mile Recruiting Team</p>`;

  return { subject, html, text };
}
