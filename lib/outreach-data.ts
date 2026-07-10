import clientPromise from "@/lib/mongodb";
import { paginatedList, parsePage, type Paginated } from "@/lib/paginate";
import { composeReplyEmailHtml, renderOutreachEmail } from "@/lib/outreach-templates";

/**
 * Data for /admin/outreach ("Emails") — EMAIL OPERATIONS ONLY.
 *
 * The funnel that used to live here (the fourth funnel in the app) is gone:
 * pipeline stages come from lib/pipeline-stages.ts and render on
 * /admin/lead-engine (Recruiting Pipeline). This page keeps:
 *   - real, labeled totals (all-time sent / last-24h / queued / failed)
 *   - the paginated sent-emails history, newest first, NO silent caps
 *   - inbound replies with one-click branded response drafts
 * Full email bodies are served on demand by /api/admin/outreach/preview.
 */

function iso(value: any): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export interface OutreachEmailStats {
  /** All-time sent (real countDocuments, not a page length). */
  sentAllTime: number;
  /** Sent in the trailing 24 hours. */
  sent24h: number;
  /** pending + retrying + sending + drafted. */
  queued: number;
  failed: number;
  skipped: number;
  total: number;
}

export type OutreachStatusFilter = "all" | "sent" | "queued" | "failed";

export interface SentEmailRow {
  id: string;
  recipient: string;
  leadName: string;
  leadType: string;
  template: string;
  subject: string;
  hasPersistedHtml: boolean;
  status: string;
  error: string;
  attempts: number;
  priority: string;
  scheduledAt: string;
  sentAt: string;
  createdAt: string;
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

const STATUS_FILTERS: Record<OutreachStatusFilter, Record<string, unknown>> = {
  all: {},
  sent: { status: "sent" },
  queued: { status: { $in: ["pending", "retrying", "sending", "drafted"] } },
  failed: { status: { $in: ["failed", "skipped"] } },
};

export function parseStatusFilter(value: unknown): OutreachStatusFilter {
  const v = String(value ?? "all");
  return v === "sent" || v === "queued" || v === "failed" ? v : "all";
}

export async function getOutreachDashboardData(opts: {
  page?: unknown;
  status?: unknown;
  repliesPage?: unknown;
} = {}): Promise<{
  emailStats: OutreachEmailStats;
  statusFilter: OutreachStatusFilter;
  sent: Omit<Paginated<never>, "rows"> & { rows: SentEmailRow[] };
  replies: Omit<Paginated<never>, "rows"> & { rows: ReplyRow[] };
  replyToInUse: string;
  inboundConfigured: boolean;
}> {
  if (!clientPromise) throw new Error("Database not configured");

  const client = await clientPromise;
  const db = client.db();
  const tasks = db.collection("outreach_tasks");

  // ── Real, labeled totals over the FULL collection ─────────────────────────
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [sentAllTime, sent24h, queued, failed, skipped, total] = await Promise.all([
    tasks.countDocuments({ status: "sent" }),
    tasks.countDocuments({ status: "sent", sentAt: { $gte: dayAgo } }),
    tasks.countDocuments({ status: { $in: ["pending", "retrying", "sending", "drafted"] } }),
    tasks.countDocuments({ status: "failed" }),
    tasks.countDocuments({ status: "skipped" }),
    tasks.countDocuments({}),
  ]);

  // ── Paginated task list, newest first ─────────────────────────────────────
  const statusFilter = parseStatusFilter(opts.status);
  const page = parsePage(opts.page);
  const { rows: rawTasks, ...pageMeta } = await paginatedList(tasks, STATUS_FILTERS[statusFilter], {
    page,
    sort: { sentAt: -1, scheduledAt: -1, createdAt: -1, _id: -1 },
    projection: {
      leadName: 1, leadType: 1, template: 1, status: 1, error: 1, attempts: 1,
      priority: 1, scheduledAt: 1, sentAt: 1, createdAt: 1, replyTo: 1,
      sentTo: 1, leadEmail: 1, renderedSubject: 1, personalization: 1,
      renderedHtml: { $cond: [{ $gt: ["$renderedHtml", ""] }, true, false] },
    },
  });

  // Join data for the per-recipient timeline (invited / clicked / replied) —
  // only for the rows on this page.
  const emails = Array.from(
    new Set(rawTasks.map((t: any) => String(t.sentTo || t.leadEmail || "").trim()).filter(Boolean))
  );
  const emailsLower = emails.map((e) => e.toLowerCase());

  const [sessions, replyDocs, prospects] = await Promise.all([
    emails.length
      ? db.collection("onboarding_sessions").find({ email: { $in: [...emails, ...emailsLower] } }).toArray()
      : Promise.resolve([]),
    emails.length
      ? db.collection("outreach_replies").find({ fromEmail: { $in: emailsLower } }).toArray()
      : Promise.resolve([]),
    emails.length
      ? db.collection("outbound_prospects").find({ "contact.email": { $in: [...emails, ...emailsLower] } }).toArray()
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

  const sentRows: SentEmailRow[] = rawTasks.map((t: any) => {
    const recipient = String(t.sentTo || t.leadEmail || "");
    const key = recipient.toLowerCase();
    const session = sessionByEmail.get(key);
    const reply = replyByEmail.get(key);
    const prospect = prospectByEmail.get(key);

    // Legacy tasks (sent before copies were persisted): re-render the
    // deterministic subject so the list never shows a blank.
    let subject = t.renderedSubject || "";
    if (!subject && t.template) {
      try {
        subject = renderOutreachEmail(
          t.template,
          { name: t.leadName, ...(t.personalization || {}) },
          t.personalization || {}
        ).subject;
      } catch {
        subject = "";
      }
    }

    return {
      id: t._id?.toString() || "",
      recipient,
      leadName: t.leadName || prospect?.name || "Unknown",
      leadType: t.leadType || "",
      template: t.template || "",
      subject,
      hasPersistedHtml: Boolean(t.renderedHtml),
      status: t.status || "pending",
      error: t.error || "",
      attempts: t.attempts || 0,
      priority: t.priority || "",
      scheduledAt: iso(t.scheduledAt),
      sentAt: iso(t.sentAt),
      createdAt: iso(t.createdAt),
      replyTo: t.replyTo || "",
      timeline: {
        invitedAt: iso(prospect?.onboardingInvitedAt || session?.createdAt),
        clickedAt: iso(session?.firstClickedAt),
        repliedAt: iso(reply?.receivedAt || prospect?.repliedAt),
        onboardingStatus: session?.status || "",
        prospectStatus: prospect?.status || "",
      },
    };
  });

  // ── Replies — paginated newest first with a real total (no silent cap) ────
  const { rows: rawReplies, ...repliesMeta } = await paginatedList(
    db.collection("outreach_replies"),
    {},
    { page: parsePage(opts.repliesPage), sort: { receivedAt: -1, _id: -1 } }
  );

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
            // Branded: same layout the send path wraps with.
            html: composeReplyEmailHtml({
              subject: r.draftResponse.subject,
              html: r.draftResponse.html || "",
              onboardingUrl: r.draftResponse.onboardingUrl,
            }),
            onboardingUrl: r.draftResponse.onboardingUrl || "",
            generatedAt: iso(r.draftResponse.generatedAt),
          }
        : null,
      responseSentAt: iso(r.responseSentAt),
      responseSentBy: r.responseSentBy || "",
    };
  });

  return {
    emailStats: { sentAllTime, sent24h, queued, failed, skipped, total },
    statusFilter,
    sent: { rows: sentRows, ...pageMeta },
    replies: { rows: replies, ...repliesMeta },
    replyToInUse:
      process.env.OUTREACH_REPLY_TO || process.env.RESEND_NOTIFY_TO || "admin@twinmile.com",
    inboundConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  };
}

export type OutreachDashboardData = Awaited<ReturnType<typeof getOutreachDashboardData>>;
