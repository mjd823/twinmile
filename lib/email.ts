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

async function sendEmail(input: SendInput) {
  if (!resend) {
    console.error(
      `[email] RESEND_API_KEY is not configured — email NOT sent (to: ${input.to}, subject: "${input.subject}"). ` +
        "Set RESEND_API_KEY in the environment to enable lead notifications and confirmations."
    );
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      replyTo: REPLY_TO,
      text: input.text,
      html: input.html,
    });
  } catch (err) {
    console.error("[email] Failed to send email:", err);
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


