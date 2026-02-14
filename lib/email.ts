import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NOTIFY_TO = process.env.RESEND_NOTIFY_TO ?? "admin@twinmile.com";
const REPLY_TO = "admin@twinmile.com";
const LOGO_URL = "https://twinmile.com/logo.png";
const APP_URL = "https://twinmile.com";

// During Resend onboarding (before domain verification) use their test sender.
// After verifying twinmile.com in Resend, switch to e.g. "leads@twinmile.com".
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

type EmailLayoutInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

type SendInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function renderEmailLayout(input: EmailLayoutInput) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${esc(input.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f4f6;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${esc(input.preheader)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:18px 8px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="background:#111827;padding:18px 22px;">
                    <img src="${LOGO_URL}" alt="Twin Mile LLC" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111827;">
                    ${input.eyebrow ? `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">${esc(input.eyebrow)}</div>` : ""}
                    <h1 style="margin:10px 0 8px;font-size:25px;line-height:1.25;color:#111827;">${esc(input.title)}</h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4b5563;">${esc(input.subtitle)}</p>
                    ${input.bodyHtml}
                    ${
                      input.primaryCta
                        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;"><tr><td style="border-radius:10px;background:#0f766e;"><a href="${esc(input.primaryCta.href)}" style="display:inline-block;padding:12px 18px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(input.primaryCta.label)}</a></td></tr></table>`
                        : ""
                    }
                    ${
                      input.secondaryCta
                        ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;"><a href="${esc(input.secondaryCta.href)}" style="color:#0f766e;text-decoration:underline;">${esc(input.secondaryCta.label)}</a></p>`
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                      Twin Mile LLC • Houston, TX<br/>
                      <a href="tel:+12817107787" style="color:#0f766e;text-decoration:none;">(281) 710-7787</a> •
                      <a href="mailto:admin@twinmile.com" style="color:#0f766e;text-decoration:none;">admin@twinmile.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendEmail(input: SendInput) {
  if (!resend) return;

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

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
