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

import { renderEmailLayout } from "@/lib/email-layout";

// Leads come from heterogeneous collections (leads_quotes, leads_drivers,
// outbound_prospects) with different shapes -- same loose typing as the
// legacy script.
export type Lead = any;
export type Personalization = any;

/**
 * Rotating openers for prospect_outreach — warmer and less form-letter than
 * the old "We found your carrier on FMCSA and wanted to reach out" opener,
 * which every prospect received verbatim. The pick is DETERMINISTIC per lead
 * (hash of email/name) so a legacy task re-rendered on the admin dashboard
 * shows the same copy that was actually sent. Provenance stays honest — each
 * variant discloses "found you through the FMCSA registry" lower in the body.
 */
interface OpenerVariant {
  subject: (lead: Lead) => string;
  html: (lead: Lead, p: Personalization) => string;
  text: (lead: Lead, p: Personalization) => string;
}

const WHY_HTML =
  `<p><strong>What our owner-operators get:</strong></p><ul><li>Competitive pay per mile — you know your number before you roll</li><li>You pick your lanes and your schedule</li><li>24/7 dispatch and driver support that actually answers</li></ul>`;
const WHY_TEXT =
  `What our owner-operators get:\n- Competitive pay per mile — you know your number before you roll\n- You pick your lanes and your schedule\n- 24/7 dispatch and driver support that actually answers`;
const PROVENANCE_HTML =
  `<p style="font-size:13px;color:#6b7280;">Quick note on how we got your info: we found your authority through the public FMCSA registry — we only reach out to active, registered carriers.</p>`;
const PROVENANCE_TEXT =
  `(Quick note on how we got your info: we found your authority through the public FMCSA registry — we only reach out to active, registered carriers.)`;
// First-touch CTA: link straight to the prospect's tokenized onboarding link
// when the invite cron provided one (personalization.onboardingUrl); legacy
// tasks without it keep the generic /drive-with-us link so re-renders of old
// sends stay byte-identical to what actually went out.
const ctaHtml = (p: Personalization) =>
  p?.onboardingUrl
    ? `<p>If you're open to it, your onboarding link is ready (about 10 minutes, saves your progress): <a href="${p.onboardingUrl}">Start onboarding</a> — or just reply to this email and I'll answer whatever you want to know about rates and lanes.</p>`
    : `<p>If you're open to it, take a look: <a href="https://twinmile.com/drive-with-us">twinmile.com/drive-with-us</a> — or just reply to this email and I'll answer whatever you want to know about rates and lanes.</p>`;
const ctaText = (p: Personalization) =>
  p?.onboardingUrl
    ? `If you're open to it, your onboarding link is ready (about 10 minutes, saves your progress): ${p.onboardingUrl} — or just reply to this email and I'll answer whatever you want to know about rates and lanes.`
    : `If you're open to it, take a look: https://twinmile.com/drive-with-us — or just reply to this email and I'll answer whatever you want to know about rates and lanes.`;
const SIGNOFF_HTML = `<p>Best regards,<br/>Marcus Chen<br/>Twin Mile Recruiting Team</p>`;
const SIGNOFF_TEXT = `Best regards,\nMarcus Chen\nTwin Mile Recruiting Team`;

const PROSPECT_OPENERS: OpenerVariant[] = [
  {
    subject: (lead) => `${lead.name || "Your carrier"} — keeping your truck loaded`,
    html: (lead, p) =>
      `<p>Hi ${p?.name || lead.name || "there"},</p><p>Running your own authority means the miles only pay when the truck is loaded. That's exactly the problem we solve at Twin Mile — steady freight for owner-operators, without giving up the independence you built.</p>${WHY_HTML}${ctaHtml(p)}${PROVENANCE_HTML}${SIGNOFF_HTML}`,
    text: (lead, p) =>
      `Hi ${p?.name || lead.name || "there"},\n\nRunning your own authority means the miles only pay when the truck is loaded. That's exactly the problem we solve at Twin Mile — steady freight for owner-operators, without giving up the independence you built.\n\n${WHY_TEXT}\n\n${ctaText(p)}\n\n${PROVENANCE_TEXT}\n\n${SIGNOFF_TEXT}`,
  },
  {
    subject: (lead) => `Steady freight for ${lead.name || "your operation"}?`,
    html: (lead, p) =>
      `<p>Hi ${p?.name || lead.name || "there"},</p><p>You've done the hard part — your own truck, your own authority. We'd like to handle the part that eats your evenings: keeping the calendar full. Twin Mile partners with owner-operators who want consistent loads without the load-board grind.</p>${WHY_HTML}${ctaHtml(p)}${PROVENANCE_HTML}${SIGNOFF_HTML}`,
    text: (lead, p) =>
      `Hi ${p?.name || lead.name || "there"},\n\nYou've done the hard part — your own truck, your own authority. We'd like to handle the part that eats your evenings: keeping the calendar full. Twin Mile partners with owner-operators who want consistent loads without the load-board grind.\n\n${WHY_TEXT}\n\n${ctaText(p)}\n\n${PROVENANCE_TEXT}\n\n${SIGNOFF_TEXT}`,
  },
  {
    subject: () => `A better week of miles — Twin Mile`,
    html: (lead, p) =>
      `<p>Hi ${p?.name || lead.name || "there"},</p><p>Most owner-operators we talk to aren't looking for a lecture about "opportunity" — they want honest rates, lanes that make sense, and dispatch that picks up the phone. That's what we run at Twin Mile, and we're adding a few more owner-operators right now.</p>${WHY_HTML}${ctaHtml(p)}${PROVENANCE_HTML}${SIGNOFF_HTML}`,
    text: (lead, p) =>
      `Hi ${p?.name || lead.name || "there"},\n\nMost owner-operators we talk to aren't looking for a lecture about "opportunity" — they want honest rates, lanes that make sense, and dispatch that picks up the phone. That's what we run at Twin Mile, and we're adding a few more owner-operators right now.\n\n${WHY_TEXT}\n\n${ctaText(p)}\n\n${PROVENANCE_TEXT}\n\n${SIGNOFF_TEXT}`,
  },
  {
    subject: (lead) => `${lead.name || "Your authority"} + Twin Mile — worth a look?`,
    html: (lead, p) =>
      `<p>Hi ${p?.name || lead.name || "there"},</p><p>I'll keep this short out of respect for your drive time. Twin Mile is a Texas-based carrier partnering with owner-operators on power-only and dry van freight — steady miles, transparent pay, no games.</p>${WHY_HTML}${ctaHtml(p)}${PROVENANCE_HTML}${SIGNOFF_HTML}`,
    text: (lead, p) =>
      `Hi ${p?.name || lead.name || "there"},\n\nI'll keep this short out of respect for your drive time. Twin Mile is a Texas-based carrier partnering with owner-operators on power-only and dry van freight — steady miles, transparent pay, no games.\n\n${WHY_TEXT}\n\n${ctaText(p)}\n\n${PROVENANCE_TEXT}\n\n${SIGNOFF_TEXT}`,
  },
];

/** Stable per-lead variant pick — same lead always renders the same email. */
function pickOpener(lead: Lead): OpenerVariant {
  const key = String(lead?.email || lead?.contact?.email || lead?.name || "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PROSPECT_OPENERS[hash % PROSPECT_OPENERS.length];
}

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
    subject: (lead) => pickOpener(lead).subject(lead),
    html: (lead, p) => pickOpener(lead).html(lead, p),
    text: (lead, p) => pickOpener(lead).text(lead, p),
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

// ─────────────────────────────────────────────────────────────────────────────
// Branded composition — every outbound email ships inside the Twin Mile
// layout (header/logo/teal CTA/footer). The cron sends EXACTLY this and the
// admin preview shows EXACTLY this.
// ─────────────────────────────────────────────────────────────────────────────

/** True when html is already a complete branded document, not a fragment. */
export function isFullEmailDocument(html: string): boolean {
  return /^\s*<!doctype/i.test(html || "");
}

interface LayoutParams {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
}

function layoutParamsFor(templateName: string, lead: Lead, p: Personalization): LayoutParams {
  const onboardingHref: string = p?.onboardingUrl || "https://twinmile.com/drive-with-us";
  switch (templateName) {
    case "prospect_outreach":
      return {
        eyebrow: "Owner-Operator Partnerships",
        title: "Keep your truck loaded",
        subtitle: "Steady freight for owner-operators — without giving up your independence.",
        primaryCta: { label: "See how it works", href: onboardingHref },
      };
    case "onboarding_followup":
      return {
        eyebrow: "Owner-Operator Partnerships",
        title: "Your onboarding link is waiting",
        subtitle: "About 10 minutes — it saves your progress as you go.",
        primaryCta: { label: "Start onboarding", href: onboardingHref },
      };
    case "quote_initial":
    case "quote_followup":
      return {
        eyebrow: "Freight Quote",
        title: "Your quote request",
        subtitle: "Thanks for reaching out — here is where things stand.",
        primaryCta: { label: "Get a quote", href: "https://twinmile.com/get-a-quote" },
      };
    case "driver_welcome":
    case "driver_followup":
      return {
        eyebrow: "Drive with Twin Mile",
        title: "Your application",
        subtitle: "Thanks for applying to drive with Twin Mile.",
        primaryCta: { label: "Drive with us", href: "https://twinmile.com/drive-with-us" },
      };
    default:
      return {
        eyebrow: "Twin Mile LLC",
        title: "A note from Twin Mile",
        subtitle: "",
      };
  }
}

/**
 * Render a template AND wrap it in the branded Twin Mile layout.
 * { subject, html, text } — html is the complete document as delivered.
 */
export function composeOutreachEmail(
  templateName: string,
  lead: Lead,
  p: Personalization
): { subject: string; html: string; text: string } {
  const t = renderOutreachEmail(templateName, lead, p);
  const params = layoutParamsFor(templateName, lead, p);
  const html = renderEmailLayout({
    preheader: t.subject,
    eyebrow: params.eyebrow,
    title: params.title,
    subtitle: params.subtitle,
    bodyHtml: t.html,
    primaryCta: params.primaryCta,
  });
  return { subject: t.subject, html, text: t.text };
}

/**
 * Wrap a PERSISTED body fragment (a task sent before the branded composer
 * shipped) in the branded layout — the fragment itself is the exact copy
 * that was delivered; the layout adds the brand chrome around it for display.
 */
export function composePersistedEmailHtml(
  templateName: string,
  subject: string,
  fragmentHtml: string,
  p: Personalization
): string {
  if (isFullEmailDocument(fragmentHtml)) return fragmentHtml;
  const params = layoutParamsFor(templateName, {}, p || {});
  return renderEmailLayout({
    preheader: subject || params.title,
    eyebrow: params.eyebrow,
    title: params.title,
    subtitle: params.subtitle,
    bodyHtml: fragmentHtml,
    primaryCta: params.primaryCta,
  });
}

/** Wrap a reply draft's html fragment in the same branded layout. */
export function composeReplyEmailHtml(draft: {
  subject?: string | null;
  html: string;
  onboardingUrl?: string | null;
}): string {
  if (isFullEmailDocument(draft.html)) return draft.html;
  return renderEmailLayout({
    preheader: draft.subject || "Re: Drive with Twin Mile",
    eyebrow: "Owner-Operator Partnerships",
    title: "Good to hear from you",
    subtitle: "Here is everything you need to take the next step.",
    bodyHtml: draft.html,
    primaryCta: draft.onboardingUrl
      ? { label: "Start onboarding", href: draft.onboardingUrl }
      : { label: "Drive with Twin Mile", href: "https://twinmile.com/drive-with-us" },
  });
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
