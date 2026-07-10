/**
 * Branded Twin Mile email layout — extracted from lib/email.ts so BOTH the
 * transactional notifications AND the outreach pipeline (composer + admin
 * preview) wrap every message in the same header/logo/teal-CTA/footer shell.
 * What the admin previews is exactly what recipients receive.
 */

const LOGO_URL = "https://twinmile.com/logo.png";

export type EmailLayoutInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmailLayout(input: EmailLayoutInput) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${esc(input.title)}</title>
        <style>
          @media screen and (max-width: 600px) {
            .tm-shell { border-radius: 12px !important; }
            .tm-header { padding: 14px 16px !important; }
            .tm-content { padding: 18px !important; }
            .tm-title { font-size: 32px !important; line-height: 1.2 !important; }
            .tm-subtitle { font-size: 15px !important; }
            .tm-footer { padding: 14px 16px !important; }
            .tm-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#eef2f7;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${esc(input.preheader)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tm-shell" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ec;">
                <tr>
                  <td class="tm-header" style="background:#111827;padding:20px 24px;">
                    <img src="${LOGO_URL}" alt="Twin Mile LLC" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;" />
                  </td>
                </tr>
                <tr>
                  <td class="tm-content" style="padding:24px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111827;">
                    ${input.eyebrow ? `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#475569;font-weight:700;">${esc(input.eyebrow)}</div>` : ""}
                    <h1 class="tm-title" style="margin:10px 0 10px;font-size:36px;line-height:1.2;color:#111827;">${esc(input.title)}</h1>
                    <p class="tm-subtitle" style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#334155;">${esc(input.subtitle)}</p>
                    ${input.bodyHtml}
                    ${
                      input.primaryCta
                        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;"><tr><td style="border-radius:11px;background:#0f766e;"><a href="${esc(input.primaryCta.href)}" class="tm-btn" style="display:inline-block;padding:13px 20px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(input.primaryCta.label)}</a></td></tr></table>`
                        : ""
                    }
                    ${
                      input.secondaryCta
                        ? `<p style="margin:14px 0 0;font-size:13px;color:#475569;"><a href="${esc(input.secondaryCta.href)}" style="color:#0f766e;text-decoration:underline;">${esc(input.secondaryCta.label)}</a></p>`
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td class="tm-footer" style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">
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
