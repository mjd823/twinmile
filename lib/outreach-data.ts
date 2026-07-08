import clientPromise from "@/lib/mongodb";
import { renderOutreachEmail } from "@/lib/outreach-templates";

/**
 * Data for /admin/outreach — pipeline funnel counts, the sent-emails history
 * (with the exact body each recipient received), and inbound replies with
 * their suggested response drafts.
 *
 * Bodies: tasks sent after the renderedSubject/renderedBody fields were added
 * use the persisted content ("persisted"); older tasks are re-rendered from
 * the deterministic template + personalization ("rendered").
 */

function iso(value: any): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export interface OutreachFunnel {
  new: number;
  reviewed: number;
  invited: number;
  clicked: number;
  replied: number;
  onboarded: number;
  totalProspects: number;
}

/** One row in a funnel-stage drill-down list. */
export interface FunnelEntry {
  name: string;
  detail: string;
  at: string;
}

export type FunnelStageKey = "new" | "reviewed" | "invited" | "clicked" | "replied" | "onboarded";

export type FunnelStageDetails = Record<FunnelStageKey, FunnelEntry[]>;

export interface SentEmailRow {
  id: string;
  recipient: string;
  leadName: string;
  company: string;
  leadType: string;
  template: string;
  subject: string;
  body: string;
  bodyHtml: string;
  bodySource: "persisted" | "rendered" | "unavailable";
  status: string;
  error: string;
  attempts: number;
  priority: string;
  scheduledAt: string;
  sentAt: string;
  replyTo: string;
  timeline: {
    invitedAt: string;
    clickedAt: string;
    repliedAt: string;
    onboardingStatus: string;
    prospectStatus: string;
  };
}

export interface ReplyRow {
  id: string;
  from: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  text: string;
  html: string;
  receivedAt: string;
  matched: boolean;
  matchedCollection: string;
  matchedName: string;
  verified: boolean;
  status: string;
  draftResponse: {
    subject: string;
    text: string;
    html: string;
    onboardingUrl: string;
    generatedAt: string;
  } | null;
  responseSentAt: string;
  responseSentBy: string;
}

export async function getOutreachDashboardData(): Promise<{
  funnel: OutreachFunnel;
  stageDetails: FunnelStageDetails;
  sentEmails: SentEmailRow[];
  replies: ReplyRow[];
  replyToInUse: string;
  inboundConfigured: boolean;
}> {
  if (!clientPromise) throw new Error("Database not configured");

  const client = await clientPromise;
  const db = client.db();

  // ------------------------------ funnel ------------------------------
  const [
    totalProspects,
    newCount,
    reviewedCount,
    invitedCount,
    clickedCount,
    prospectRepliedCount,
    inboundReplyEmails,
    onboardedCount,
  ] = await Promise.all([
    db.collection("outbound_prospects").countDocuments(),
    db.collection("outbound_prospects").countDocuments({ status: "new" }),
    db.collection("outbound_prospects").countDocuments({ status: "reviewed" }),
    db.collection("outbound_prospects").countDocuments({ status: "onboarding_invited" }),
    db.collection("onboarding_sessions").countDocuments({
      leadType: "outbound_prospect",
      $or: [
        { firstClickedAt: { $exists: true } },
        { status: { $in: ["started", "documents_submitted", "completed"] } },
      ],
    }),
    db.collection("outbound_prospects").countDocuments({
      $or: [{ status: "replied" }, { repliedAt: { $exists: true } }],
    }),
    // Replies captured by the Resend inbound webhook (outreach_replies) —
    // counted by distinct sender so multiple emails from one prospect = 1.
    db.collection("outreach_replies").distinct("fromEmail"),
    db.collection("onboarding_sessions").countDocuments({
      leadType: "outbound_prospect",
      status: "completed",
    }),
  ]);
  const repliedCount = Math.max(prospectRepliedCount, inboundReplyEmails.length);

  // -------------------- funnel stage drill-down lists --------------------
  const entry = (name: any, detail: any, at: any): FunnelEntry => ({
    name: String(name || "Unknown"),
    detail: String(detail || ""),
    at: iso(at),
  });

  const [newDocs, reviewedDocs, invitedDocs, clickedDocs, repliedDocs, onboardedDocs] =
    await Promise.all([
      db.collection("outbound_prospects").find({ status: "new" })
        .sort({ createdAt: -1 }).limit(200)
        .project({ name: 1, contact: 1, createdAt: 1 }).toArray(),
      db.collection("outbound_prospects").find({ status: "reviewed" })
        .sort({ createdAt: -1 }).limit(200)
        .project({ name: 1, contact: 1, createdAt: 1 }).toArray(),
      db.collection("outbound_prospects").find({ status: "onboarding_invited" })
        .sort({ updatedAt: -1, createdAt: -1 }).limit(200)
        .project({ name: 1, contact: 1, invitedAt: 1, updatedAt: 1, createdAt: 1 }).toArray(),
      db.collection("onboarding_sessions").find({
        leadType: "outbound_prospect",
        $or: [
          { firstClickedAt: { $exists: true } },
          { status: { $in: ["started", "documents_submitted", "completed"] } },
        ],
      }).sort({ firstClickedAt: -1 }).limit(200)
        .project({ name: 1, leadName: 1, email: 1, firstClickedAt: 1, createdAt: 1 }).toArray(),
      db.collection("outreach_replies").find({})
        .sort({ receivedAt: -1 }).limit(200)
        .project({ fromName: 1, fromEmail: 1, receivedAt: 1 }).toArray(),
      db.collection("onboarding_sessions").find({ leadType: "outbound_prospect", status: "completed" })
        .sort({ completedAt: -1 }).limit(200)
        .project({ name: 1, leadName: 1, email: 1, completedAt: 1 }).toArray(),
    ]);

  const stageDetails: FunnelStageDetails = {
    new: newDocs.map((p: any) => entry(p.name, p.contact?.email || p.contact?.phone, p.createdAt)),
    reviewed: reviewedDocs.map((p: any) => entry(p.name, p.contact?.email || p.contact?.phone, p.createdAt)),
    invited: invitedDocs.map((p: any) => entry(p.name, p.contact?.email || p.contact?.phone, p.invitedAt || p.updatedAt || p.createdAt)),
    clicked: clickedDocs.map((s: any) => entry(s.name || s.leadName, s.email, s.firstClickedAt || s.createdAt)),
    replied: repliedDocs.map((r: any) => entry(r.fromName || r.fromEmail, r.fromEmail, r.receivedAt)),
    onboarded: onboardedDocs.map((s: any) => entry(s.name || s.leadName, s.email, s.completedAt)),
  };

  // --------------------------- sent emails ----------------------------
  const rawTasks = await db
    .collection("outreach_tasks")
    .find({})
    .sort({ sentAt: -1, scheduledAt: -1, createdAt: -1 })
    .limit(200)
    .toArray();

  // Join data for the per-recipient timeline (invited / clicked / replied).
  const emails = Array.from(
    new Set(
      rawTasks
        .map((t: any) => String(t.sentTo || t.leadEmail || "").trim())
        .filter(Boolean)
    )
  );
  const emailsLower = emails.map((e) => e.toLowerCase());

  const [sessions, replyDocs, prospects] = await Promise.all([
    emails.length
      ? db
          .collection("onboarding_sessions")
          .find({ email: { $in: [...emails, ...emailsLower] } })
          .toArray()
      : Promise.resolve([]),
    emails.length
      ? db
          .collection("outreach_replies")
          .find({ fromEmail: { $in: emailsLower } })
          .toArray()
      : Promise.resolve([]),
    emails.length
      ? db
          .collection("outbound_prospects")
          .find({ "contact.email": { $in: [...emails, ...emailsLower] } })
          .toArray()
      : Promise.resolve([]),
  ]);

  const sessionByEmail = new Map<string, any>();
  for (const s of sessions as any[]) {
    const key = String(s.email || "").toLowerCase();
    if (!sessionByEmail.has(key)) sessionByEmail.set(key, s);
  }
  const replyByEmail = new Map<string, any>();
  for (const r of replyDocs as any[]) {
    const key = String(r.fromEmail || "").toLowerCase();
    const prev = replyByEmail.get(key);
    if (!prev || new Date(r.receivedAt) > new Date(prev.receivedAt)) replyByEmail.set(key, r);
  }
  const prospectByEmail = new Map<string, any>();
  for (const p of prospects as any[]) {
    const key = String(p.contact?.email || "").toLowerCase();
    if (!prospectByEmail.has(key)) prospectByEmail.set(key, p);
  }

  const sentEmails: SentEmailRow[] = rawTasks.map((t: any) => {
    const recipient = String(t.sentTo || t.leadEmail || "");
    const key = recipient.toLowerCase();

    let subject = t.renderedSubject || "";
    let body = t.renderedBody || "";
    let bodyHtml = t.renderedHtml || "";
    let bodySource: SentEmailRow["bodySource"] = t.renderedSubject ? "persisted" : "unavailable";
    if (!t.renderedSubject) {
      // Legacy task (sent before persistence was added): re-render from the
      // deterministic template + the personalization snapshot on the task.
      try {
        const pseudoLead = { name: t.leadName, ...(t.personalization || {}) };
        const rendered = renderOutreachEmail(t.template, pseudoLead, t.personalization || {});
        subject = rendered.subject;
        body = rendered.text;
        bodyHtml = rendered.html;
        bodySource = "rendered";
      } catch {
        bodySource = "unavailable";
      }
    }

    const session = sessionByEmail.get(key);
    const reply = replyByEmail.get(key);
    const prospect = prospectByEmail.get(key);

    return {
      id: t._id?.toString() || "",
      recipient,
      leadName: t.leadName || prospect?.name || "Unknown",
      company: prospect?.company || prospect?.name || "",
      leadType: t.leadType || "",
      template: t.template || "",
      subject,
      body,
      bodyHtml,
      bodySource,
      status: t.status || "pending",
      error: t.error || "",
      attempts: t.attempts || 0,
      priority: t.priority || "",
      scheduledAt: iso(t.scheduledAt),
      sentAt: iso(t.sentAt),
      replyTo: t.replyTo || "",
      timeline: {
        invitedAt: iso(session?.createdAt),
        clickedAt: iso(session?.firstClickedAt),
        repliedAt: iso(reply?.receivedAt || prospect?.repliedAt),
        onboardingStatus: session?.status || "",
        prospectStatus: prospect?.status || "",
      },
    };
  });

  // ------------------------------ replies ------------------------------
  const rawReplies = await db
    .collection("outreach_replies")
    .find({})
    .sort({ receivedAt: -1 })
    .limit(100)
    .toArray();

  const matchedIds = rawReplies
    .filter((r: any) => r.matchedProspectId && r.matchedCollection === "outbound_prospects")
    .map((r: any) => r.matchedProspectId);
  const matchedProspects = matchedIds.length
    ? await db.collection("outbound_prospects").find({ _id: { $in: matchedIds } }).toArray()
    : [];
  const prospectById = new Map<string, any>(
    (matchedProspects as any[]).map((p) => [p._id.toString(), p])
  );

  const replies: ReplyRow[] = rawReplies.map((r: any) => {
    const matchedName =
      (r.matchedProspectId && prospectById.get(r.matchedProspectId.toString())?.name) ||
      r.fromName ||
      "";
    return {
      id: r._id?.toString() || "",
      from: r.from || "",
      fromEmail: r.fromEmail || "",
      fromName: r.fromName || "",
      subject: r.subject || "",
      snippet: r.snippet || "",
      text: r.text || "",
      html: r.html || "",
      receivedAt: iso(r.receivedAt),
      matched: Boolean(r.matchedProspectId),
      matchedCollection: r.matchedCollection || "",
      matchedName,
      verified: Boolean(r.verified),
      status: r.status || "received",
      draftResponse: r.draftResponse
        ? {
            subject: r.draftResponse.subject || "",
            text: r.draftResponse.text || "",
            html: r.draftResponse.html || "",
            onboardingUrl: r.draftResponse.onboardingUrl || "",
            generatedAt: iso(r.draftResponse.generatedAt),
          }
        : null,
      responseSentAt: iso(r.responseSentAt),
      responseSentBy: r.responseSentBy || "",
    };
  });

  return {
    funnel: {
      new: newCount,
      reviewed: reviewedCount,
      invited: invitedCount,
      clicked: clickedCount,
      replied: repliedCount,
      onboarded: onboardedCount,
      totalProspects,
    },
    stageDetails,
    sentEmails,
    replies,
    replyToInUse:
      process.env.OUTREACH_REPLY_TO || process.env.RESEND_NOTIFY_TO || "admin@twinmile.com",
    inboundConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  };
}

export type OutreachDashboardData = Awaited<ReturnType<typeof getOutreachDashboardData>>;
