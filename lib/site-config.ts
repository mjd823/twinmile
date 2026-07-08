/**
 * Centralized site configuration — no hardcoded values scattered across the app.
 * All business-critical values live here and can be overridden by environment variables.
 */

export const SITE_CONFIG = {
  // Company identity
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "Twin Mile LLC",
  mcNumber: process.env.NEXT_PUBLIC_MC_NUMBER || "MC1790263",
  // TODO(MJ): supply the real USDOT number. Left empty on purpose — the
  // footer/drive-with-us trust block hides it until a real value is set.
  // Do NOT put a placeholder/invented number here.
  dotNumber: process.env.NEXT_PUBLIC_DOT_NUMBER || "",
  city: process.env.NEXT_PUBLIC_COMPANY_CITY || "Houston",
  state: process.env.NEXT_PUBLIC_COMPANY_STATE || "TX",

  // Contact
  phone: process.env.NEXT_PUBLIC_PHONE || "(281) 710-7787",
  phoneRaw: process.env.NEXT_PUBLIC_PHONE_RAW || "+12817107787",
  email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@twinmile.com",
  notifyEmail: process.env.RESEND_NOTIFY_TO || "admin@twinmile.com",

  // Email
  fromEmail: process.env.RESEND_FROM_EMAIL || "Twin Mile <alerts@contact.twinmile.com>",

  // URLs
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://twinmile.com",

  // Program details
  program: {
    type: "Power-Only",
    payRate: "80% gross",
    paymentSchedule: "Weekly direct deposit by Tuesday",
    signOnFee: "20% (10% MC + 3% factoring + 7% dispatch)",
    tokenHours: 72,
  },

  // FMCSA Prospecting
  prospecting: {
    targetStates: (process.env.FMCSA_TARGET_STATES || "TX,LA,CA,GA,TN").split(","),
    maxResults: parseInt(process.env.FMCSA_MAX_RESULTS || "30", 10),
    minScore: parseInt(process.env.MIN_AI_SCORE || "75", 10),
    maxLeadsPerRun: parseInt(process.env.MAX_LEADS_PER_RUN || "30", 10),
  },

  // Social
  twitter: process.env.NEXT_PUBLIC_TWITTER || "@twinmilellc",

  // Analytics
  gaId: process.env.NEXT_PUBLIC_GA_ID || "G-RQ0CTNQDNY",
} as const;

// Helper to get the onboarding URL with token
export function getOnboardingUrl(token: string): string {
  return `${SITE_CONFIG.appUrl}/onboarding?token=${token}`;
}

// Helper to format phone for tel: links
export function getPhoneLink(): string {
  return `tel:${SITE_CONFIG.phoneRaw}`;
}