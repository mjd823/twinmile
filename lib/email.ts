import { Resend } from "resend";
import { renderEmailLayout, esc } from "@/lib/email-layout";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? "admin@twinmile.com";
const REPLY_TO = "admin@twinmile.com";
const APP_URL = "https://twinmile.com";

// During Resend onboarding (before domain verification) use their test sender.
// After verifying twinmile.com in Resend, switch to e.g. "leads@twinmile.com".
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

type SendInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Never throws — a failed notification must not fail the request that triggered
 * it. Returns whether the provider actually accepted the message: callers that
 * record "we told a human" (or that suppress a repeat alert for 24h) must not
 * treat an unconfigured key or a provider error as delivered.
 */
async function sendEmail(input: SendInput): Promise<boolean> {
  if (!resend) {
    console.error(
      `[email] RESEND_API_KEY is not configured — email NOT sent (to: ${input.to}, subject: "${input.subject}"). ` +
        "Set RESEND_API_KEY in the environment to enable lead notifications and confirmations."
    );
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      replyTo: REPLY_TO,
      text: input.text,
      html: input.html,
    });
    if (error) {
      console.error("[email] Resend rejected the message:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}

function detailRow(label: string, value: string) {
  return `<tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${esc(value || "—")}</td></tr>`;
}

/**
 * Fire-and-forget lead notification email.
 * Never throws — logs errors so form submission is never blocked.
 */
export async function notifyNewQuoteLead(lead: {
  name: string;
  company?: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
}) {
  const html = renderEmailLayout({
    preheader: `New quote lead: ${lead.name}`,
    eyebrow: "Lead Notification",
    title: "New quote request",
    subtitle: "A customer submitted the Get a Quote form.",
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("Name", lead.name)}
        ${lead.company ? detailRow("Company", lead.company) : ""}
        ${detailRow("Email", lead.email)}
        ${detailRow("Phone", lead.phone)}
        ${detailRow("Pickup", lead.pickupLocation)}
        ${detailRow("Drop-off", lead.dropoffLocation)}
        ${detailRow("Service", lead.serviceType)}
      </table>
    `,
    primaryCta: { label: "Open Admin Inbox", href: `${APP_URL}/admin/inbox` },
  });

  await sendEmail({
    to: NOTIFY_TO,
    subject: `New Quote Lead: ${lead.name}`,
    text:
      `New quote request from ${lead.name}.\n` +
      `Email: ${lead.email}\nPhone: ${lead.phone}\n` +
      `Pickup: ${lead.pickupLocation}\nDrop-off: ${lead.dropoffLocation}\n` +
      `Service: ${lead.serviceType}\n` +
      `Admin inbox: ${APP_URL}/admin/inbox`,
    html,
  });
}

export async function notifyNewDriverLead(lead: {
  fullName: string;
  email: string;
  phone: string;
  truckType: string;
  yearsExperience?: string;
}) {
  const html = renderEmailLayout({
    preheader: `New driver application: ${lead.fullName}`,
    eyebrow: "Lead Notification",
    title: "New driver application",
    subtitle: "A driver submitted the Drive With Us form.",
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("Name", lead.fullName)}
        ${detailRow("Email", lead.email)}
        ${detailRow("Phone", lead.phone)}
        ${detailRow("Truck Type", lead.truckType)}
        ${lead.yearsExperience ? detailRow("Experience", lead.yearsExperience) : ""}
      </table>
    `,
    primaryCta: { label: "Open Admin Inbox", href: `${APP_URL}/admin/inbox` },
  });

  await sendEmail({
    to: NOTIFY_TO,
    subject: `New Driver Application: ${lead.fullName}`,
    text:
      `New driver application from ${lead.fullName}.\n` +
      `Email: ${lead.email}\nPhone: ${lead.phone}\n` +
      `Truck type: ${lead.truckType}\n` +
      `${lead.yearsExperience ? `Experience: ${lead.yearsExperience}\n` : ""}` +
      `Admin inbox: ${APP_URL}/admin/inbox`,
    html,
  });
}

/**
 * A driver finished onboarding.
 *
 * WHY THIS EXISTS (2026-08-06): /api/onboarding/complete created the user, closed
 * the session, attached the documents, recorded what the applicant deferred, and
 * wrote an agent_activity row — then told nobody. Seeing a completed application
 * depended on somebody opening the admin panel. Across 962 onboarding sessions
 * not one completion had ever been announced, and the owner was onboarding real
 * drivers the same day this shipped.
 *
 * The deferral list is the point. A driver who ticked "send me the agreement to
 * review before I sign" has NOT signed, and that is a phone call to make today —
 * not a record to discover next week. Same for outstanding documents.
 *
 * Never throws: a failed alert must not fail a submission the driver already
 * completed. They would see an error and reasonably assume their application
 * vanished, and the retry would hit the already-completed path.
 */
export async function notifyOnboardingComplete(app: {
  fullName: string;
  email: string;
  phone?: string;
  leaseSigned: boolean;
  deferredItems: string[];
  outstandingDocuments: string[];
  driverUserId: string;
}): Promise<boolean> {
  try {
    const needsFollowUp = [...app.deferredItems, ...app.outstandingDocuments];
    const signLabel = app.leaseSigned
      ? "Signed"
      : "NOT SIGNED — applicant asked to review it first";

    const html = renderEmailLayout({
      preheader: `${app.fullName} completed onboarding${app.leaseSigned ? "" : " (lease unsigned)"}`,
      eyebrow: "Onboarding",
      title: `${app.fullName} completed onboarding`,
      subtitle: app.leaseSigned
        ? "Application complete and the lease is signed."
        : "Application complete, but the lease still needs a signature.",
      bodyHtml: `
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
          ${detailRow("Name", app.fullName)}
          ${detailRow("Email", app.email)}
          ${app.phone ? detailRow("Phone", app.phone) : ""}
          ${detailRow("Lease agreement", signLabel)}
          ${
            needsFollowUp.length
              ? detailRow("Needs follow-up", needsFollowUp.join(", "))
              : detailRow("Needs follow-up", "Nothing outstanding")
          }
        </table>
      `,
      primaryCta: { label: "Open Driver Record", href: `${APP_URL}/admin/drivers` },
    });

    return await sendEmail({
      to: NOTIFY_TO,
      subject: app.leaseSigned
        ? `Onboarding complete: ${app.fullName}`
        : `Onboarding complete (LEASE UNSIGNED): ${app.fullName}`,
      text:
        `${app.fullName} completed driver onboarding.\n` +
        `Email: ${app.email}\n${app.phone ? `Phone: ${app.phone}\n` : ""}` +
        `Lease agreement: ${signLabel}\n` +
        `Needs follow-up: ${needsFollowUp.length ? needsFollowUp.join(", ") : "nothing outstanding"}\n` +
        `Driver record: ${APP_URL}/admin/drivers`,
      html,
    });
  } catch (err) {
    console.error("[email] notifyOnboardingComplete failed:", err);
    return false;
  }
}

/**
 * A prospect replied. THIS is the notification that did not exist: the inbound
 * webhook wrote outreach_replies, stamped repliedAt, logged agent_activity and
 * generated a draft — and told nobody. Seeing a reply depended entirely on
 * somebody happening to open /admin/outreach. A reply is the only outcome the
 * whole cold-outreach machine exists to produce; it cannot sit in a collection
 * waiting to be noticed.
 *
 * Costs nothing extra (same Resend account already used for sending) and never
 * throws — an alert failure must not fail the webhook, because Resend would
 * then retry and the idempotent upsert would take the duplicate path, meaning
 * the retry alerts nobody either.
 */
export async function notifyProspectReply(reply: {
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  matchedName?: string | null;
  matchedCollection?: string | null;
  verified?: boolean;
}): Promise<boolean> {
  const who = reply.matchedName || reply.fromName || reply.fromEmail;
  const subject = reply.subject?.trim() || "(no subject)";
  const html = renderEmailLayout({
    preheader: `Reply from ${who}: ${subject}`,
    eyebrow: "Outreach Reply",
    title: `${who} replied`,
    subtitle: "A prospect answered a Twin Mile outreach email. Reply from the admin outreach page.",
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("From", reply.fromEmail)}
        ${detailRow("Subject", subject)}
        ${detailRow("Matched", reply.matchedCollection || "no matching prospect/lead record")}
        ${detailRow("Signed", reply.verified ? "yes (webhook signature verified)" : "NO — webhook secret not configured")}
      </table>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${esc(reply.snippet || "(no body captured)")}</p>
    `,
    primaryCta: { label: "Open Outreach Replies", href: `${APP_URL}/admin/outreach` },
  });

  return sendEmail({
    to: NOTIFY_TO,
    subject: `Outreach REPLY from ${who}: ${subject}`.slice(0, 180),
    text:
      `${who} replied to a Twin Mile outreach email.\n` +
      `From: ${reply.fromEmail}\nSubject: ${subject}\n` +
      `Matched: ${reply.matchedCollection || "no matching prospect/lead record"}\n` +
      `Signature verified: ${reply.verified ? "yes" : "no"}\n\n` +
      `${reply.snippet || "(no body captured)"}\n\n` +
      `Respond here: ${APP_URL}/admin/outreach`,
    html,
  });
}

/**
 * A critical blocker only a human can clear has been open too long.
 *
 * The blockers registry was working correctly — outreach_paused has carried an
 * honest firstRaisedAt since 2026-07-29 — but nothing ESCALATED it. An hourly
 * lastSeenAt bump and a routedAroundCount counter are not an alarm, so a
 * critical item sat open for over a week while sending stayed dark. This is the
 * one path that reaches the owner's phone.
 */
export async function notifyStaleBlockers(
  blockers: { key: string; title: string; humanAction?: string; ageHours: number }[]
): Promise<boolean> {
  if (!blockers.length) return false;
  const rows = blockers
    .map(
      (b) =>
        `<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><div style="font-size:14px;font-weight:700;color:#111827;">${esc(b.title)} <span style="font-weight:400;color:#6b7280;">(${Math.floor(b.ageHours / 24)}d open)</span></div><div style="font-size:13px;line-height:1.5;color:#4b5563;">${esc(b.humanAction || "No human action recorded on this blocker.")}</div></td></tr>`
    )
    .join("");

  const html = renderEmailLayout({
    preheader: `${blockers.length} critical blocker(s) waiting on you`,
    eyebrow: "Needs A Human",
    title: `${blockers.length} critical blocker(s) open past 72 hours`,
    subtitle: "The agents have been routing around these. They cannot clear them.",
    bodyHtml: `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table>`,
    primaryCta: { label: "Open Admin", href: `${APP_URL}/admin` },
  });

  return sendEmail({
    to: NOTIFY_TO,
    subject: `${blockers.length} critical Twin Mile blocker(s) open past 72h`,
    text:
      blockers
        .map(
          (b) =>
            `${b.title} — open ${Math.floor(b.ageHours / 24)} day(s)\n  ${b.humanAction || "No human action recorded."}`
        )
        .join("\n\n") + `\n\nAdmin: ${APP_URL}/admin`,
    html,
  });
}

export async function sendQuoteLeadConfirmation(lead: {
  name: string;
  email: string;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
}) {
  const html = renderEmailLayout({
    preheader: "We received your quote request.",
    eyebrow: "Twin Mile",
    title: "We received your quote request",
    subtitle: "Thank you for reaching out. Our team will review your request and follow up shortly.",
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("Requested Service", lead.serviceType)}
        ${detailRow("Route", `${lead.pickupLocation} → ${lead.dropoffLocation}`)}
      </table>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
        If you need to add details or timing updates, reply directly to this email and our team will help right away.
      </p>
    `,
    primaryCta: { label: "Contact Twin Mile", href: `${APP_URL}/contact` },
    secondaryCta: { label: "Explore Services", href: `${APP_URL}/services` },
  });

  await sendEmail({
    to: lead.email,
    subject: "We received your quote request — Twin Mile",
    text:
      `Hi ${lead.name},\n\n` +
      `We received your quote request (${lead.serviceType}) for ${lead.pickupLocation} -> ${lead.dropoffLocation}.\n` +
      `Our team will follow up shortly.\n\n` +
      `Contact us: ${APP_URL}/contact\n`,
    html,
  });
}

export async function sendDriverLeadConfirmation(lead: {
  fullName: string;
  email: string;
  truckType: string;
}) {
  const html = renderEmailLayout({
    preheader: "We received your driver application.",
    eyebrow: "Twin Mile",
    title: "We received your driver application",
    subtitle: "Thanks for applying to drive with Twin Mile. We review every submission and will contact you soon.",
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("Applicant", lead.fullName)}
        ${detailRow("Equipment", lead.truckType)}
      </table>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
        If anything changed (availability, equipment, lanes), reply to this email and include the update.
      </p>
    `,
    primaryCta: { label: "Contact Twin Mile", href: `${APP_URL}/contact` },
    secondaryCta: { label: "View Opportunities", href: `${APP_URL}/drive-with-us` },
  });

  await sendEmail({
    to: lead.email,
    subject: "We received your driver application — Twin Mile",
    text:
      `Hi ${lead.fullName},\n\n` +
      `We received your driver application (${lead.truckType}).\n` +
      `Our team will review and contact you soon.\n\n` +
      `Contact us: ${APP_URL}/contact\n`,
    html,
  });
}


