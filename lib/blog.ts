export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTime: string;
  content: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "time-critical-shipping-checklist",
    title: "Time-Critical Shipping: A Practical Checklist",
    description:
      "A fast checklist to reduce delays and keep urgent freight moving — from pickup details to proof of delivery.",
    publishedAt: "2025-12-23",
    readingTime: "4 min",
    content: [
      "Time-critical freight fails when details are unclear. The goal is simple: remove ambiguity.",
      "Confirm pickup and dropoff windows, access constraints, contact names, and required paperwork.",
      "Communicate early, communicate often — and document changes in writing.",
      "Have a backup plan: alternate access, contingency routing, and escalation contacts when a dock window slips.",
      "Treat communication like an SLA. The shipper shouldn’t have to chase updates.",
    ],
  },
  {
    slug: "hotshot-vs-traditional-freight",
    title: "Hotshot vs Traditional Freight: When Speed Wins",
    description:
      "How to decide between hotshot trucking and traditional freight options based on timeline, load type, and risk.",
    publishedAt: "2025-12-23",
    readingTime: "5 min",
    content: [
      "Hotshot works when urgency matters and the load fits the equipment profile.",
      "Traditional freight is ideal for heavier loads, planned schedules, and cost-optimized shipping.",
      "The best choice balances speed, risk, and total cost of delay.",
      "When timelines are tight, measure the cost of a missed deadline — not just the rate.",
      "If your schedule can’t slip, pay for certainty: dedicated execution and proactive communication.",
    ],
  },
  {
    slug: "last-mile-delivery-what-goes-wrong",
    title: "Last-Mile Delivery: What Usually Goes Wrong (and How to Prevent It)",
    description:
      "Last-mile failures are usually predictable — access, timing, and communication. Here’s how to reduce reattempts and delays.",
    publishedAt: "2025-12-24",
    readingTime: "6 min",
    content: [
      "Last-mile delivery is where small details become big delays.",
      "The three most common failure points are access restrictions, unclear contacts, and unrealistic delivery windows.",
      "Prevent reattempts by confirming gate codes, dock instructions, and on-site contact details at dispatch.",
      "If the receiver has a strict window, treat it as a hard constraint — build the route around it.",
      "Professional handoffs matter: clear documentation, photos when needed, and proof of delivery closeout.",
    ],
  },
  {
    slug: "how-to-request-a-freight-quote-that-doesnt-slip",
    title: "How to Request a Freight Quote That Doesn’t Slip",
    description:
      "A quote is only as good as the details behind it. Provide these inputs to get accurate pricing and reliable execution.",
    publishedAt: "2025-12-24",
    readingTime: "7 min",
    content: [
      "Many quote issues come from missing constraints, not bad intent.",
      "Include pickup/drop addresses, windows, contact names, access notes, and any paperwork requirements.",
      "Call out special handling: liftgate, inside delivery, appointments, limited access, or high-value procedures.",
      "If the timeline is urgent, say so explicitly — and share what happens if the deadline is missed.",
      "A reliable quote includes a plan: equipment fit, routing reality, and communication expectations.",
    ],
  },
  {
    slug: "dispatch-vs-3pl-vs-carrier-whats-the-difference",
    title: "Dispatch vs 3PL vs Carrier: What’s the Difference?",
    description:
      "Understanding who owns execution, coordination, and risk helps you choose the right logistics partner.",
    publishedAt: "2025-12-24",
    readingTime: "8 min",
    content: [
      "The word 'logistics' gets used for everything — but roles are different.",
      "A carrier executes transportation. A dispatcher coordinates drivers and loads. A 3PL coordinates broader logistics across partners.",
      "The key question: who owns the outcome when something changes mid-load?",
      "Hybrid operators can combine direct execution with coordination when the job needs more reach.",
      "Choose based on constraints: urgency, complexity, compliance, and how much visibility you need.",
    ],
  },
  {
    slug: "time-critical-freight-communication-sla",
    title: "Time-Critical Freight: Treat Communication Like an SLA",
    description:
      "In urgent logistics, silence is risk. Here’s a simple communication cadence that prevents delays and escalations.",
    publishedAt: "2025-12-24",
    readingTime: "6 min",
    content: [
      "When a load is urgent, the shipper shouldn’t have to chase updates.",
      "A simple cadence works: pickup confirmed, in-transit update, ETA confirmation, delivery confirmed.",
      "If anything changes, notify immediately with the new plan — and document it in writing.",
      "Communication reduces cost: fewer escalations, fewer reworks, and faster resolution when exceptions happen.",
      "The highest-end logistics operators sell certainty — and certainty requires visibility.",
    ],
  },
  {
    slug: "reducing-detention-layover-and-accessorial-surprises",
    title: "Reducing Detention, Layover, and Accessorial Surprises",
    description:
      "Detention and accessorials aren’t always avoidable, but many are preventable. Here’s how to reduce surprises.",
    publishedAt: "2025-12-24",
    readingTime: "7 min",
    content: [
      "Accessorials usually happen when expectations aren’t aligned.",
      "Confirm appointment requirements, dock scheduling, and who is responsible for loading/unloading.",
      "Capture access constraints early: limited access, liftgate, inside delivery, jobsite restrictions.",
      "If a facility has a pattern of delays, plan with buffer and escalation contacts.",
      "The best outcome is predictable execution — the second best is predictable communication when reality changes.",
    ],
  },
  {
    slug: "hotshot-loads-equipment-fit-and-risk",
    title: "Hotshot Loads: Equipment Fit, Timeline Risk, and When to Say No",
    description:
      "Hotshot is powerful — but only when equipment fit and timeline risk are understood. Here’s a practical decision framework.",
    publishedAt: "2025-12-24",
    readingTime: "8 min",
    content: [
      "Hotshot is not just 'faster' — it’s a different risk profile.",
      "Validate the load: dimensions, weight, securement requirements, and whether the route has access constraints.",
      "If the deadline is immovable, plan like it: confirm pickup readiness and eliminate paperwork ambiguity.",
      "When to say no: unclear shipper details, impossible windows, or handling requirements that don’t match equipment.",
      "Professional hotshot execution is about discipline — not speed alone.",
    ],
  },
];

export function getPostBySlug(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
