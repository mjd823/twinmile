/**
 * Topic bank for the weekly auto-blog pipeline.
 *
 * Audience: CDL drivers and owner-operators (recruiting-adjacent SEO) plus
 * Houston/Texas freight topics. Every topic ships with candidate CITATION
 * sources — strongly preferring .gov (FMCSA, BLS, DOL, EIA, BTS). Sources are
 * HTTP-verified at generation time (lib/blog-generate.ts); unverifiable ones
 * are dropped and a draft with fewer than 2 live citations is flagged
 * needsWork for the human reviewer.
 */

export interface TopicSource {
  url: string;
  title: string;
  /** Publisher label shown in the article's Sources list */
  source: string;
}

export interface BlogTopic {
  id: string;
  /** Working title / angle handed to the model (it may refine the headline) */
  title: string;
  angle: string;
  keywords: string[];
  candidateSources: TopicSource[];
}

export const BLOG_TOPICS: BlogTopic[] = [
  {
    id: "cdl-class-a-guide",
    title: "How to Get a Class A CDL in Texas: Step-by-Step Guide",
    angle:
      "Practical career guide for someone considering trucking: ELDT requirement, permit, skills test, medical card, realistic timeline and costs (qualitative — do not invent dollar figures).",
    keywords: ["how to get CDL Texas", "Class A CDL requirements", "CDL training steps"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/registration/commercial-drivers-license",
        title: "Commercial Driver's License (CDL)",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/registration/commercial-drivers-license/entry-level-driver-training-eldt",
        title: "Entry-Level Driver Training (ELDT)",
        source: "FMCSA",
      },
      {
        url: "https://www.bls.gov/ooh/transportation-and-material-moving/heavy-and-tractor-trailer-truck-drivers.htm",
        title: "Heavy and Tractor-Trailer Truck Drivers — Occupational Outlook Handbook",
        source: "BLS",
      },
    ],
  },
  {
    id: "owner-operator-vs-company-driver",
    title: "Owner-Operator vs Company Driver: The Real Economics",
    angle:
      "Honest comparison of the two paths: who carries which costs (truck payment, maintenance, insurance, fuel), revenue vs take-home framing, and who each path fits. Company pay claims limited to Twin Mile's verified numbers.",
    keywords: ["owner operator vs company driver", "owner operator economics", "lease on to a carrier"],
    candidateSources: [
      {
        url: "https://www.bls.gov/ooh/transportation-and-material-moving/heavy-and-tractor-trailer-truck-drivers.htm",
        title: "Heavy and Tractor-Trailer Truck Drivers — Occupational Outlook Handbook",
        source: "BLS",
      },
      {
        url: "https://www.fmcsa.dot.gov/registration",
        title: "FMCSA Registration",
        source: "FMCSA",
      },
      {
        url: "https://www.dol.gov/agencies/whd/fact-sheets/19-flsa-motor-carrier",
        title: "Fact Sheet #19: The Motor Carrier Exemption under the FLSA",
        source: "DOL",
      },
    ],
  },
  {
    id: "hours-of-service-explained",
    title: "FMCSA Hours of Service Rules, Explained in Plain English",
    angle:
      "Compliance explainer: 11-hour driving limit, 14-hour window, 30-minute break, 60/70-hour limits, sleeper berth — described qualitatively with the reader pointed at the FMCSA source for exact current rules.",
    keywords: ["hours of service rules", "HOS explained", "FMCSA 14 hour rule"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/regulations/hours-of-service",
        title: "Hours of Service (HOS)",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations",
        title: "Summary of Hours of Service Regulations",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "eld-mandate-basics",
    title: "The ELD Mandate: What Every Driver Should Know",
    angle:
      "What electronic logging devices are, who must use them, common exemptions, and how ELDs interact with hours-of-service compliance day to day.",
    keywords: ["ELD mandate", "electronic logging device rules", "ELD exemptions"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/hours-service/elds/electronic-logging-devices",
        title: "Electronic Logging Devices",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/regulations/hours-of-service",
        title: "Hours of Service (HOS)",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "dot-medical-card-guide",
    title: "DOT Medical Card: Requirements, Exam, and Renewal",
    angle:
      "What the DOT physical covers, who needs it, certificate validity, and conditions that commonly require follow-up — pointing readers to FMCSA's medical program for specifics.",
    keywords: ["DOT medical card", "DOT physical requirements", "CDL medical exam"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/medical",
        title: "FMCSA Medical Program",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/medical/driver-medical-requirements/dot-medical-exam-and-commercial-motor-vehicle-certification",
        title: "DOT Medical Exam and Commercial Motor Vehicle Certification",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "power-only-trucking-explained",
    title: "What Is Power Only Trucking? A Guide for Owner-Operators",
    angle:
      "Explain the power-only model (tractor pulls pre-loaded customer trailers), why it lowers barrier to entry (no trailer investment), tradeoffs, and who it fits. Twin Mile runs power-only — company claims restricted to verified facts.",
    keywords: ["power only trucking", "power only loads", "no trailer owner operator"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/registration",
        title: "FMCSA Registration",
        source: "FMCSA",
      },
      {
        url: "https://www.bts.gov/topics/freight-transportation",
        title: "Freight Transportation",
        source: "BTS",
      },
    ],
  },
  {
    id: "houston-freight-market",
    title: "Why Houston Is One of the Best Freight Markets for Drivers",
    angle:
      "Houston/Texas freight overview: port volume, energy sector, distribution density, lane variety — qualitative claims only, cite BTS/Census for data, no invented statistics.",
    keywords: ["Houston freight market", "Texas trucking jobs", "Houston owner operator"],
    candidateSources: [
      {
        url: "https://www.bts.gov/topics/freight-transportation",
        title: "Freight Transportation",
        source: "BTS",
      },
      {
        url: "https://www.bts.gov/faf",
        title: "Freight Analysis Framework",
        source: "BTS",
      },
    ],
  },
  {
    id: "new-authority-first-90-days",
    title: "Your First 90 Days with New Trucking Authority: A Survival Guide",
    angle:
      "New MC number reality: insurance costs are highest at the start, many brokers wait out new authorities, the New Entrant safety audit — and when leasing onto an established carrier makes more sense.",
    keywords: ["new trucking authority", "new MC number", "new entrant safety audit"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/registration",
        title: "FMCSA Registration",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/safety/new-entrant-safety-assurance-program",
        title: "New Entrant Safety Assurance Program",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "fuel-surcharge-explained",
    title: "How Fuel Surcharges Work (and Why 100% Pass-Through Matters)",
    angle:
      "Explain fuel surcharge mechanics, how diesel price indexes (EIA) drive them, and why the percentage of surcharge passed to the truck materially changes owner-operator math.",
    keywords: ["fuel surcharge explained", "100% fuel surcharge", "diesel prices owner operator"],
    candidateSources: [
      {
        url: "https://www.eia.gov/petroleum/gasdiesel/",
        title: "Gasoline and Diesel Fuel Update",
        source: "EIA",
      },
      {
        url: "https://www.bls.gov/ooh/transportation-and-material-moving/heavy-and-tractor-trailer-truck-drivers.htm",
        title: "Heavy and Tractor-Trailer Truck Drivers — Occupational Outlook Handbook",
        source: "BLS",
      },
    ],
  },
  {
    id: "drug-alcohol-clearinghouse",
    title: "The FMCSA Drug & Alcohol Clearinghouse: What Drivers Need to Know",
    angle:
      "What the Clearinghouse is, when queries happen (pre-employment, annual), what a violation means for your CDL, and the return-to-duty process.",
    keywords: ["FMCSA clearinghouse", "drug and alcohol clearinghouse CDL", "return to duty process"],
    candidateSources: [
      {
        url: "https://clearinghouse.fmcsa.dot.gov/",
        title: "FMCSA Drug & Alcohol Clearinghouse",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/regulations/commercial-drivers-license-drug-and-alcohol-clearinghouse",
        title: "Commercial Driver's License Drug and Alcohol Clearinghouse",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "csa-scores-explained",
    title: "CSA Scores Explained: How Safety Ratings Affect Your Career",
    angle:
      "How the Compliance, Safety, Accountability program works, the BASIC categories, how violations follow drivers, and practical habits that keep records clean.",
    keywords: ["CSA scores explained", "BASIC categories trucking", "driver safety record"],
    candidateSources: [
      {
        url: "https://csa.fmcsa.dot.gov/",
        title: "Compliance, Safety, Accountability (CSA)",
        source: "FMCSA",
      },
      {
        url: "https://www.fmcsa.dot.gov/regulations",
        title: "FMCSA Regulations",
        source: "FMCSA",
      },
    ],
  },
  {
    id: "truck-maintenance-owner-operator",
    title: "Preventive Maintenance for Owner-Operators: Protecting Your Biggest Asset",
    angle:
      "Why preventive maintenance discipline separates profitable owner-operators from broke ones: inspection habits, the cost-of-downtime framing (qualitative), and DOT inspection readiness.",
    keywords: ["owner operator maintenance", "truck preventive maintenance", "DOT inspection checklist"],
    candidateSources: [
      {
        url: "https://www.fmcsa.dot.gov/regulations",
        title: "FMCSA Regulations",
        source: "FMCSA",
      },
      {
        url: "https://csa.fmcsa.dot.gov/",
        title: "Compliance, Safety, Accountability (CSA)",
        source: "FMCSA",
      },
    ],
  },
];

export function getTopicById(id: string): BlogTopic | null {
  return BLOG_TOPICS.find((t) => t.id === id) ?? null;
}
