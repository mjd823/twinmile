/**
 * THE LEASE-ON AGREEMENT, AS DATA.
 *
 * WHY THIS FILE EXISTS: there is no lease PDF anywhere in this repo, and never
 * was. The only copy of the agreement was hardcoded JSX inside
 * components/onboarding/OnboardingPortal.tsx, which means:
 *
 *   - an applicant who ticked "send me the agreement to review before I sign"
 *     could not be sent anything, because the text existed only inside a React
 *     component that renders in a browser; and
 *   - the moment a second surface (an email, a standalone signing page) quoted
 *     the terms, the two copies could drift — and a lease whose emailed terms
 *     differ from its signed terms is worse than no lease at all.
 *
 * So the terms live here, once, as plain data. Every surface renders FROM here:
 *   - components/onboarding/OnboardingPortal.tsx  (in-flow e-sign step)
 *   - lib/email.ts sendLeaseAgreementForReview()  (the emailed copy)
 *   - app/lease/sign/page.tsx                     (the deferred signing page)
 *
 * Changing a number here changes it in all three at once. Do not restate any of
 * these figures anywhere else.
 *
 * TERMS_VERSION is stamped on every lease_agreements record at signature time,
 * so a signature can always be traced to the exact wording it accepted.
 */

export const LEASE_TERMS_VERSION = "2026-08";

export const LEASE_CARRIER = {
  name: "Twin Mile LLC",
  mcNumber: "MC-1790263",
  location: "Houston, TX",
} as const;

/** Fee split. The individual lines must sum to LEASE_TOTAL_FEE. */
export const LEASE_FEES: readonly { label: string; value: string }[] = [
  { label: "MC Usage Fee", value: "10%" },
  { label: "Factoring Fee", value: "3%" },
  { label: "Dispatching Fee", value: "7%" },
];

export const LEASE_TOTAL_FEE = "20%";

export const LEASE_PAYMENT_SCHEDULE = "Weekly direct deposit by Tuesday";

export const LEASE_REQUIREMENTS: readonly string[] = [
  "Valid CDL with endorsements",
  "DOT Medical Examiner Certificate",
  "Annual DOT truck inspection",
  "COI with Twin Mile as certificate holder",
  "ELD compliance (FMCSA regs)",
  "Clean MVR on request",
];

export const LEASE_PENALTIES: readonly string[] = [
  "Failed DOT inspection: $1,000 fine + termination",
  "Unreported DOT inspection: $1,000 fine",
  "Unauthorized MC use: $1,000 + termination",
  "Double brokering: $2,000 + termination",
  "Driver change without notice: $500",
  "7-day written termination notice",
];

export const LEASE_SECTIONS: readonly { n: number; title: string; body: string }[] = [
  {
    n: 1,
    title: "Purpose",
    body: "Carrier leases Owner-Operator's vehicle(s) for interstate property transportation under Carrier's FMCSA authority.",
  },
  {
    n: 2,
    title: "Term",
    body: "Commences on signing. 7-day termination notice. Renewable by written agreement.",
  },
  {
    n: 3,
    title: "Compliance",
    body: "DOT physical, annual inspection, CDL, HOS, ELD, MVR. Report violations immediately.",
  },
  {
    n: 4,
    title: "Financial Terms",
    body: "20% total (10% MC + 3% factoring + 7% dispatch). Weekly payout by Tuesday. Expedited payment TBD.",
  },
  {
    n: 5,
    title: "Liability",
    body: "Owner-Operator insurance is primary. At-fault accident may result in termination.",
  },
  {
    n: 6,
    title: "Termination",
    body: "7-day notice, material breach, or automatic for violations per Section 4.",
  },
  {
    n: 7,
    title: "Dispute Resolution",
    body: "Harris County, Texas law applies.",
  },
  {
    n: 8,
    title: "Miscellaneous",
    body: "Texas governing law. Entire agreement. Written amendments only.",
  },
];

/** Who the agreement is between. */
export function leasePreamble(operatorName: string): string {
  const who = operatorName.trim() || "[Owner-Operator]";
  return (
    `This Lease-On Agreement is made between ${LEASE_CARRIER.name} ` +
    `(Carrier, ${LEASE_CARRIER.mcNumber}, ${LEASE_CARRIER.location}) and ` +
    `${who} (Owner-Operator).`
  );
}

/**
 * The whole agreement as plain text. Used as the text/plain half of the review
 * email — an applicant on a phone with images blocked must still be able to
 * read every term he is being asked to sign.
 */
export function leaseTermsPlainText(operatorName: string): string {
  const lines: string[] = [
    `LEASE-ON AGREEMENT (version ${LEASE_TERMS_VERSION})`,
    "",
    leasePreamble(operatorName),
    "",
    "PAYMENT STRUCTURE",
    ...LEASE_FEES.map((f) => `  ${f.label}: ${f.value}`),
    `  Total sign-on: ${LEASE_TOTAL_FEE}`,
    `  ${LEASE_PAYMENT_SCHEDULE}`,
    "",
    "REQUIREMENTS",
    ...LEASE_REQUIREMENTS.map((r) => `  - ${r}`),
    "",
    "PENALTIES & TERMINATION",
    ...LEASE_PENALTIES.map((p) => `  - ${p}`),
    "",
    "FULL AGREEMENT",
  ];
  for (const s of LEASE_SECTIONS) {
    lines.push(`  ${s.n}. ${s.title}`, `     ${s.body}`);
  }
  return lines.join("\n");
}
