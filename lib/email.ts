import { Resend } from "resend";
import { renderEmailLayout, esc } from "@/lib/email-layout";
import { SITE_CONFIG } from "@/lib/site-config";
import { humanizeSender } from "@/lib/sending-policy";
import {
  LEASE_FEES,
  LEASE_PAYMENT_SCHEDULE,
  LEASE_PENALTIES,
  LEASE_REQUIREMENTS,
  LEASE_SECTIONS,
  LEASE_TOTAL_FEE,
  leasePreamble,
  leaseTermsPlainText,
} from "@/lib/lease-terms";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? "admin@twinmile.com";
const REPLY_TO = "admin@twinmile.com";
const APP_URL = "https://twinmile.com";

// contact.twinmile.com is DNS-verified (SPF + DKIM), so the old
// "onboarding@resend.dev" fallback could only ever do harm: if RESEND_FROM_EMAIL
// were cleared in Vercel, every owner notification — including the onboarding
// alerts — would silently start leaving from Resend's SHARED test domain, which
// fails DMARC alignment for twinmile.com and lands in spam. A missing env var
// must not be able to reroute the owner's only notification channel.
// humanizeSender() additionally rewrites a robot local-part (alerts@, noreply@)
// which is a Promotions-placement signal; see lib/sending-policy.ts.
const FROM = humanizeSender(SITE_CONFIG.fromEmail);

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

/** Freeze the exact owner notification before its first delivery attempt. */
export function buildQuoteOwnerEmail(lead: {
  name: string;
  company?: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
  pickupDate?: string;
  notes?: string;
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
        ${lead.pickupDate ? detailRow("Pickup date", lead.pickupDate) : ""}
        ${lead.notes ? detailRow("Customer notes", lead.notes) : ""}
      </table>
    `,
    primaryCta: { label: "Open Admin Inbox", href: `${APP_URL}/admin/inbox` },
  });

  return {
    from: FROM,
    replyTo: lead.email,
    to: NOTIFY_TO,
    subject: `New Quote Lead: ${lead.name}`,
    text:
      `New quote request from ${lead.name}.\n` +
      `Email: ${lead.email}\nPhone: ${lead.phone}\n` +
      `Pickup: ${lead.pickupLocation}\nDrop-off: ${lead.dropoffLocation}\n` +
      `Service: ${lead.serviceType}\n` +
      `Pickup date: ${lead.pickupDate || "Not specified"}\nNotes: ${lead.notes || "None"}\n` +
      `Admin inbox: ${APP_URL}/admin/inbox`,
    html,
  };
}

export async function notifyNewQuoteLead(lead: Parameters<typeof buildQuoteOwnerEmail>[0]) {
  return sendEmail(buildQuoteOwnerEmail(lead));
}

export async function sendQuoteOwnerEmail(payload: ReturnType<typeof buildQuoteOwnerEmail>, idempotencyKey: string) {
  if (!resend) return { ok: false, reason: "email-not-configured" };
  const result = await resend.emails.send(payload, { idempotencyKey, signal: AbortSignal.timeout(8000) } as import("resend").CreateEmailRequestOptions & { signal: AbortSignal });
  return result.data?.id ? { ok: true, providerId: result.data.id } : { ok: false, reason: result.error?.name || "provider-acceptance-unknown" };
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
  /**
   * Did the applicant's own emails actually leave? A failed welcome email means
   * the driver is holding an account he cannot log into and does not know it —
   * the only recovery is a phone call, so it has to reach the owner here rather
   * than sit in a server log.
   */
  welcomeEmailSent?: boolean;
  agreementEmailSent?: boolean;
}): Promise<boolean> {
  try {
    const needsFollowUp = [...app.deferredItems, ...app.outstandingDocuments];
    const signLabel = app.leaseSigned
      ? "Signed"
      : "NOT SIGNED — applicant asked to review it first";

    // Only reported when it FAILED. A successful send is the expected case and
    // does not need a line in an alert the owner reads on a phone.
    const mailFailures: string[] = [];
    if (app.welcomeEmailSent === false) {
      mailFailures.push("login credentials email FAILED — call the driver");
    }
    if (app.agreementEmailSent === false) {
      mailFailures.push("lease agreement email FAILED — he is waiting for it");
    }

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
          ${mailFailures.length ? detailRow("EMAIL FAILURE", mailFailures.join(" | ")) : ""}
        </table>
      `,
      primaryCta: { label: "Open Driver Record", href: `${APP_URL}/admin/drivers` },
    });

    const subject = app.leaseSigned
      ? `Onboarding complete: ${app.fullName}`
      : `Onboarding complete (LEASE UNSIGNED): ${app.fullName}`;

    return await sendEmail({
      to: NOTIFY_TO,
      // A mail failure is put in the SUBJECT because it is the only case here
      // that needs action within the hour.
      subject: mailFailures.length ? `ACTION NEEDED — ${subject}` : subject,
      text:
        `${app.fullName} completed driver onboarding.\n` +
        `Email: ${app.email}\n${app.phone ? `Phone: ${app.phone}\n` : ""}` +
        `Lease agreement: ${signLabel}\n` +
        `Needs follow-up: ${needsFollowUp.length ? needsFollowUp.join(", ") : "nothing outstanding"}\n` +
        `${mailFailures.length ? `EMAIL FAILURE: ${mailFailures.join(" | ")}\n` : ""}` +
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
    // "We will follow up shortly" is not a next step. This email used to end
    // there, and the only shipper lead in company history then sat untouched for
    // 91 days. A commitment with a deadline and a number the shipper can dial
    // himself is the difference between a receipt and a conversation.
    subtitle: `A dispatcher will follow up within one business day. Need it sooner — call ${SITE_CONFIG.phone}.`,
    bodyHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
        ${detailRow("Requested Service", lead.serviceType)}
        ${detailRow("Route", `${lead.pickupLocation} → ${lead.dropoffLocation}`)}
        ${detailRow("Next step", "A Twin Mile dispatcher follows up within one business day")}
      </table>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
        Weight, dimensions, pickup window or anything else that affects the rate — reply to this email and it goes
        straight to the person quoting you. To talk now, call ${esc(SITE_CONFIG.phone)}.
      </p>
    `,
    primaryCta: { label: "Contact Twin Mile", href: `${APP_URL}/contact` },
    secondaryCta: { label: "Explore Services", href: `${APP_URL}/services` },
  });

  return sendEmail({
    to: lead.email,
    subject: "We received your quote request — Twin Mile",
    text:
      `Hi ${lead.name},\n\n` +
      `We received your quote request (${lead.serviceType}) for ${lead.pickupLocation} -> ${lead.dropoffLocation}.\n\n` +
      `Next step: a Twin Mile dispatcher will follow up within one business day.\n` +
      `Need it sooner, or want to add weight/dimensions/pickup window? Reply to this email or call ${SITE_CONFIG.phone}.\n\n` +
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

/**
 * The driver's login credentials.
 *
 * WHY THIS EXISTS (2026-08-06): the last screen of onboarding promised "you'll
 * receive an email with your temporary login credentials within 24 hours" and
 * listed "Temporary password emailed to you". No such email existed anywhere in
 * this repo. /api/onboarding/complete generated the password, returned it in the
 * JSON response, and the portal read only `data.error` and threw the password
 * away — so the credential was destroyed at the exact moment it was promised.
 * Every other surface in the app tells an ADMIN to "copy and send" it by hand.
 *
 * Nobody has been burned yet only because zero drivers have completed
 * onboarding. The next one would have been.
 *
 * The password is sent by email rather than shown on screen on purpose: the
 * screen is gone as soon as the tab closes, and it was also being returned in a
 * JSON body that any browser extension or proxy log could read.
 */
export async function sendDriverWelcome(driver: {
  fullName: string;
  email: string;
  tempPassword: string;
}): Promise<boolean> {
  try {
    const loginUrl = `${APP_URL}/driver/login`;
    const html = renderEmailLayout({
      preheader: "Your Twin Mile driver portal login",
      eyebrow: "Driver Portal",
      title: "Your login details",
      subtitle:
        "Your Twin Mile driver account is created. Sign in and you will be asked to choose your own password.",
      bodyHtml: `
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
          ${detailRow("Email", driver.email)}
          ${detailRow("Temporary password", driver.tempPassword)}
        </table>
        <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
          This password is temporary — you will be prompted to change it the first time you sign in.
          Your application is under review; the dispatch board fills in once you are approved.
        </p>
      `,
      primaryCta: { label: "Sign in to the driver portal", href: loginUrl },
    });

    return await sendEmail({
      to: driver.email,
      subject: "Your Twin Mile driver portal login",
      text:
        `Hi ${driver.fullName},\n\n` +
        `Your Twin Mile driver account is ready.\n\n` +
        `Email: ${driver.email}\n` +
        `Temporary password: ${driver.tempPassword}\n\n` +
        `Sign in: ${loginUrl}\n` +
        `You will be asked to choose your own password on first sign-in.\n\n` +
        `Your application is under review — the dispatch board fills in once you are approved.\n`,
      html,
    });
  } catch (err) {
    console.error("[email] sendDriverWelcome failed:", err);
    return false;
  }
}

/**
 * The Lease-On Agreement, sent to an applicant who asked to read it before
 * signing.
 *
 * WHY THIS EXISTS (2026-08-06): the e-sign step is the real drop-off point of
 * this funnel — a person who has already handed over his DOB, SSN last-4 and
 * USDOT is asked, on a phone, to sign a 20% fee and five penalty clauses. A July
 * session added "send me the agreement to review before I sign" so that wanting
 * to sleep on it no longer meant abandoning the application. The deferral was
 * recorded correctly, the lease record was written as awaiting_signature, and
 * the owner got an alert — and the applicant was sent NOTHING. The promise on
 * the checkbox ("we'll follow up") was not kept by any code path.
 *
 * The terms are carried IN THE BODY of this email because no lease PDF exists in
 * this repo — there is nothing to attach. They come from lib/lease-terms.ts, the
 * same source the in-flow step and the signing page render, so the emailed text
 * and the signed text cannot diverge.
 *
 * Not gated by OUTREACH_AUTOMATION: that flag pauses COLD outreach. This is a
 * document a named applicant asked for.
 */
export async function sendLeaseAgreementForReview(app: {
  fullName: string;
  email: string;
  signingToken: string;
}): Promise<boolean> {
  try {
    const signUrl = `${APP_URL}/lease/sign?t=${encodeURIComponent(app.signingToken)}`;
    const cell =
      'style="padding:4px 0;font-size:13px;line-height:1.5;color:#374151;"';

    const html = renderEmailLayout({
      preheader: "The Twin Mile Lease-On Agreement, for you to review and sign",
      eyebrow: "Lease-On Agreement",
      title: "The agreement you asked to review",
      subtitle:
        "Every term is below. When you are ready, the button at the bottom signs it — nothing is signed until you do.",
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">${esc(
          leasePreamble(app.fullName)
        )}</p>

        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
          <tr><td colspan="2" style="padding:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;">Payment structure</td></tr>
          ${LEASE_FEES.map((f) => detailRow(f.label, f.value)).join("")}
          ${detailRow("Total sign-on", LEASE_TOTAL_FEE)}
          ${detailRow("Payment schedule", LEASE_PAYMENT_SCHEDULE)}
        </table>

        <p style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;">Requirements</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
          ${LEASE_REQUIREMENTS.map((r) => `<tr><td ${cell}>• ${esc(r)}</td></tr>`).join("")}
        </table>

        <p style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#b45309;">Penalties &amp; termination</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:10px;">
          ${LEASE_PENALTIES.map((p) => `<tr><td ${cell}>• ${esc(p)}</td></tr>`).join("")}
        </table>

        <p style="margin:18px 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475569;">Full agreement</p>
        ${LEASE_SECTIONS.map(
          (s) =>
            `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#374151;"><strong>${s.n}. ${esc(
              s.title
            )}</strong><br/>${esc(s.body)}</p>`
        ).join("")}

        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
          Questions before you sign? Reply to this email or call ${esc(SITE_CONFIG.phone)} — that is a better use of your time than signing something you are unsure about.
        </p>
      `,
      primaryCta: { label: "Review and sign", href: signUrl },
    });

    return await sendEmail({
      to: app.email,
      subject: "Your Twin Mile Lease-On Agreement — review and sign",
      text:
        `Hi ${app.fullName},\n\n` +
        `You asked to read the Lease-On Agreement before signing. Here it is in full.\n\n` +
        `${leaseTermsPlainText(app.fullName)}\n\n` +
        `When you are ready, sign here: ${signUrl}\n` +
        `Nothing is signed until you do.\n\n` +
        `Questions first? Reply to this email or call ${SITE_CONFIG.phone}.\n`,
      html,
    });
  } catch (err) {
    console.error("[email] sendLeaseAgreementForReview failed:", err);
    return false;
  }
}

/**
 * An applicant stopped partway through onboarding. Nudge him back to the exact
 * step he left, with the link he already has.
 *
 * WHY THIS EXISTS (2026-08-06): notifyOnboardingComplete only fires on
 * SUBMISSION. Someone who quits at the signature step never submits, so he
 * produces no deferredItems record, no completion alert and no email — he is
 * invisible to every alert this system has. One real applicant sat at step 4
 * for 37 days having already entered his DOB, SSN last-4, address, truck VIN and
 * USDOT number, and nothing ever contacted him.
 *
 * Not gated by OUTREACH_AUTOMATION: this is a person mid-application, not a cold
 * prospect.
 */
export async function sendOnboardingResumeNudge(app: {
  name: string;
  email: string;
  resumeUrl: string;
  currentStep: number;
}): Promise<boolean> {
  try {
    const html = renderEmailLayout({
      preheader: "Your Twin Mile application is saved — pick up where you left off",
      eyebrow: "Owner-Operator Onboarding",
      title: "Your application is saved",
      subtitle: `You stopped at step ${app.currentStep} of 7. Everything you already entered is still there.`,
      bodyHtml: `
        <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
          One link, same place you left it. If something in the agreement or the paperwork is the reason you stopped,
          reply to this email or call ${esc(SITE_CONFIG.phone)} and a person will walk you through it — you do not have
          to figure it out on your own.
        </p>
      `,
      primaryCta: { label: "Finish my application", href: app.resumeUrl },
    });

    return await sendEmail({
      to: app.email,
      subject: "Your Twin Mile application is saved — finish when you're ready",
      text:
        `Hi ${app.name || "there"},\n\n` +
        `You stopped at step ${app.currentStep} of 7 of your Twin Mile onboarding. Everything you entered is saved.\n\n` +
        `Pick up here: ${app.resumeUrl}\n\n` +
        `If the agreement or the paperwork is why you stopped, reply to this email or call ${SITE_CONFIG.phone} and a person will walk you through it.\n`,
      html,
    });
  } catch (err) {
    console.error("[email] sendOnboardingResumeNudge failed:", err);
    return false;
  }
}

/**
 * Tell the owner about applicants who stalled mid-application.
 *
 * The nudge email above is the automated half. This is the half that matters
 * more: these people left a PHONE NUMBER in their session. A warm applicant who
 * got most of the way through an application is worth a call, not another email.
 */
export async function notifyStalledOnboarding(
  people: { name: string; email: string; phone?: string; currentStep: number; idleDays: number }[]
): Promise<boolean> {
  if (!people.length) return false;
  const rows = people
    .map(
      (p) =>
        `<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><div style="font-size:14px;font-weight:700;color:#111827;">${esc(
          p.name || p.email
        )} <span style="font-weight:400;color:#6b7280;">— step ${p.currentStep} of 7, idle ${p.idleDays}d</span></div><div style="font-size:13px;line-height:1.5;color:#4b5563;">${esc(
          p.phone ? `Call ${p.phone}` : "No phone on file"
        )} · ${esc(p.email)}</div></td></tr>`
    )
    .join("");

  const html = renderEmailLayout({
    preheader: `${people.length} applicant(s) stalled mid-onboarding`,
    eyebrow: "Warm Leads",
    title: `${people.length} applicant(s) stopped mid-application`,
    subtitle:
      "Each one has been sent a resume link. These are the warmest leads the company has — a call beats an email.",
    bodyHtml: `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${rows}</table>`,
    primaryCta: { label: "Open Admin", href: `${APP_URL}/admin` },
  });

  return sendEmail({
    to: NOTIFY_TO,
    subject: `${people.length} Twin Mile applicant(s) stalled mid-onboarding`,
    text:
      people
        .map(
          (p) =>
            `${p.name || p.email} — step ${p.currentStep} of 7, idle ${p.idleDays} day(s)\n  ${
              p.phone ? `Call ${p.phone}` : "No phone on file"
            } · ${p.email}`
        )
        .join("\n\n") + `\n\nEach has been emailed a resume link.\nAdmin: ${APP_URL}/admin`,
    html,
  });
}


