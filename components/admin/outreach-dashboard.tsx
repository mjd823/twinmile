"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail,
  MailOpen,
  Reply,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MousePointerClick,
  UserCheck,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Pager } from "@/components/admin/Pager";
import { EmailPreviewFrame } from "@/components/admin/EmailPreviewFrame";
import { stageDef } from "@/lib/pipeline-stages";
import type {
  OutreachDashboardData,
  SentEmailRow,
  ReplyRow,
  OutreachStatusFilter,
} from "@/lib/outreach-data";

function fmt(dateIso: string): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  // Always America/Chicago — the business clock the owner works in.
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  failed: "border-red-500/30 bg-red-500/10 text-red-500",
  skipped: "border-red-500/20 bg-red-500/5 text-red-400",
  retrying: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  pending: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  sending: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  drafted: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  received: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  responded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] || "border-border bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header stats — every number labeled with its window, all-time totals real
// ─────────────────────────────────────────────────────────────────────────────

function StatChips({ stats }: { stats: OutreachDashboardData["emailStats"] }) {
  const chips = [
    { label: "sent all-time", value: stats.sentAllTime, tone: "text-emerald-500" },
    { label: "sent last 24h", value: stats.sent24h, tone: "text-emerald-400" },
    { label: "queued (paused)", value: stats.queued, tone: "text-sky-500" },
    { label: "failed", value: stats.failed, tone: "text-red-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {chips.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3.5">
            <div className={cn("text-2xl font-bold tabular-nums", c.tone)}>
              {c.value.toLocaleString()}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline (unchanged concept: strictly chronological, plain English)
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  label: string;
  at: string;
  icon: React.ElementType;
}

function ProspectTimeline({ email }: { email: SentEmailRow }) {
  const events: TimelineEvent[] = [
    // Canonical stage label — "Invited" always means the outreach email went out.
    { label: stageDef("invited").label, at: email.timeline.invitedAt, icon: UserCheck },
    { label: "Invite email delivered", at: email.sentAt, icon: Mail },
    { label: "Opened their onboarding link", at: email.timeline.clickedAt, icon: MousePointerClick },
    { label: "Replied to us", at: email.timeline.repliedAt, icon: Reply },
  ];
  const happened = events
    .filter((e) => Boolean(e.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const pending = events.filter((e) => !e.at);

  return (
    <ol className="space-y-2">
      {[...happened, ...pending].map((e, i) => {
        const done = Boolean(e.at);
        const Icon = e.icon;
        return (
          <li key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-border bg-muted text-muted-foreground/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("text-xs font-medium", !done && "text-muted-foreground/60")}>
                {e.label}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {done ? `${fmt(e.at)} CT` : "not yet"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Email detail — the REAL branded email, fetched from the preview endpoint
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewPayload {
  subject: string;
  html: string;
  text: string;
  source: "persisted" | "recomposed" | "unavailable";
}

function EmailDetailDialog({
  email,
  onClose,
}: {
  email: SentEmailRow | null;
  onClose: () => void;
}) {
  const [preview, setPreview] = React.useState<PreviewPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!email) {
      setPreview(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/outreach/preview?taskId=${email.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error || "Preview failed");
        setPreview(json);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Preview failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  return (
    <Dialog open={Boolean(email)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {email && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">
                {preview?.subject || email.subject || "(no subject)"}
              </DialogTitle>
              <DialogDescription>
                To <span className="font-medium text-foreground">{email.leadName}</span>{" "}
                &lt;{email.recipient || "no email"}&gt; · template{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{email.template}</code>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={email.status} />
              {email.sentAt ? <span>Sent {fmt(email.sentAt)}</span> : <span>Scheduled {fmt(email.scheduledAt)}</span>}
              {email.replyTo && <span>· replies to {email.replyTo}</span>}
              {preview && (
                <span>
                  ·{" "}
                  {preview.source === "persisted"
                    ? "exact copy as sent"
                    : preview.source === "recomposed"
                      ? "re-rendered from template (sent before copies were stored)"
                      : "content unavailable"}
                </span>
              )}
            </div>

            {email.status === "failed" && email.error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Failed after {email.attempts} attempt{email.attempts === 1 ? "" : "s"}: {email.error}
                </span>
              </div>
            )}

            <div className="rounded-md border border-border/60 bg-muted/30 p-3 sm:p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email as the recipient sees it
              </div>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : preview?.html ? (
                <EmailPreviewFrame html={preview.html} />
              ) : (
                <p className="text-sm text-muted-foreground">Body not available for this task.</p>
              )}
              {preview?.text && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Show plain-text version
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
                    {preview.text}
                  </pre>
                </details>
              )}
            </div>

            <div className="rounded-md border border-border/60 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prospect timeline (in order)
              </div>
              <ProspectTimeline email={email} />
              {(email.timeline.prospectStatus || email.timeline.onboardingStatus) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {email.timeline.prospectStatus && (
                    <span>
                      Prospect status: <StatusBadge status={email.timeline.prospectStatus} />
                    </span>
                  )}
                  {email.timeline.onboardingStatus && (
                    <span>
                      Onboarding: <StatusBadge status={email.timeline.onboardingStatus} />
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sent tab — paginated, newest first, real totals, status filter
// ─────────────────────────────────────────────────────────────────────────────

const FILTERS: { key: OutreachStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "queued", label: "Queued" },
  { key: "failed", label: "Failed" },
];

function SentEmailsTab({ data }: { data: OutreachDashboardData }) {
  const [selected, setSelected] = React.useState<SentEmailRow | null>(null);
  const { sent, statusFilter } = data;
  const makeHref = (page: number) =>
    `/admin/outreach?status=${statusFilter}&page=${page}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/outreach?status=${f.key}&page=1`}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Pager
        page={sent.page}
        pageCount={sent.pageCount}
        pageSize={sent.pageSize}
        total={sent.total}
        makeHref={makeHref}
      />

      {sent.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No emails here. Queued outreach shows once tasks exist; sending stays paused until the
            system is production-ready.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border/60 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Template</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {sent.rows.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/50"
                    onClick={() => setSelected(e)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.leadName}</div>
                      <div className="text-xs text-muted-foreground">{e.recipient || "no email"}</div>
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3">{e.subject || "—"}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.template}</code>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                      {e.status === "failed" && e.error && (
                        <div className="mt-1 max-w-[200px] truncate text-xs text-red-400" title={e.error}>
                          {e.error}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {fmt(e.sentAt || e.scheduledAt || e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {sent.rows.map((e) => (
              <button
                key={e.id}
                className="rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:bg-accent/50"
                onClick={() => setSelected(e)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.leadName}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.recipient || "no email"}</div>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <div className="mt-1.5 truncate text-sm text-muted-foreground">{e.subject || "—"}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {fmt(e.sentAt || e.scheduledAt || e.createdAt)}
                </div>
              </button>
            ))}
          </div>

          <Pager
            page={sent.page}
            pageCount={sent.pageCount}
            pageSize={sent.pageSize}
            total={sent.total}
            makeHref={makeHref}
          />
        </>
      )}

      <EmailDetailDialog email={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Replies
// ─────────────────────────────────────────────────────────────────────────────

function ReplyCard({
  reply,
  onSent,
}: {
  reply: ReplyRow;
  onSent: (id: string, sentAt: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");

  const alreadySent = reply.status === "responded" || Boolean(reply.responseSentAt);

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/outreach/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId: reply.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Send failed");
      onSent(reply.id, json.sentAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <MailOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{reply.matchedName || reply.fromName || reply.fromEmail}</span>
              {reply.matched ? (
                <Badge variant="secondary" className="text-[10px]">matched prospect</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">unmatched sender</Badge>
              )}
              {!reply.verified && (
                <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
                  unverified webhook
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {reply.fromEmail} · {fmt(reply.receivedAt)}
            </div>
          </div>
          <StatusBadge status={reply.status} />
        </div>

        <div>
          <div className="text-sm font-medium">{reply.subject || "(no subject)"}</div>
          <div
            className={cn(
              "mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground",
              !expanded && "line-clamp-3"
            )}
          >
            {reply.text || reply.snippet || "(no body captured)"}
          </div>
          {(reply.text || "").length > 200 && (
            <button
              className="mt-1 text-xs font-medium text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : "Show full message"}
            </button>
          )}
        </div>

        {reply.draftResponse ? (
          <div className="rounded-md border border-sky-500/25 bg-sky-500/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-500">
              <Sparkles className="h-3.5 w-3.5" />
              Suggested response {alreadySent ? "(sent)" : "(draft — not sent)"}
            </div>
            <div className="text-sm font-medium">{reply.draftResponse.subject}</div>
            {reply.draftResponse.html ? (
              <div className="mt-2">
                <EmailPreviewFrame html={reply.draftResponse.html} minHeight={280} title="Reply draft preview" />
              </div>
            ) : (
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
                {reply.draftResponse.text}
              </pre>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {alreadySent ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sent {fmt(reply.responseSentAt)}
                  {reply.responseSentBy ? ` by ${reply.responseSentBy}` : ""}
                </span>
              ) : (
                <Button size="sm" onClick={handleSend} disabled={sending}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {sending ? "Sending…" : "Send response"}
                </Button>
              )}
              {error && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="h-3.5 w-3.5" />
                  {error}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No draft was generated for this reply (OUTREACH_AUTOREPLY may be off).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RepliesTab({
  replies,
  meta,
  statusFilter,
  inboundConfigured,
  replyToInUse,
  onSent,
}: {
  replies: ReplyRow[];
  meta: { total: number; page: number; pageCount: number; pageSize: number };
  statusFilter: OutreachStatusFilter;
  inboundConfigured: boolean;
  replyToInUse: string;
  onSent: (id: string, sentAt: string) => void;
}) {
  const makeHref = (page: number) =>
    `/admin/outreach?tab=replies&status=${statusFilter}&rpage=${page}`;
  return (
    <div className="space-y-3">
      {!inboundConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Inbound reply capture is not fully configured. Outreach replies currently go to{" "}
            <span className="font-medium">{replyToInUse}</span>. To capture them here: enable
            Receiving on contact.twinmile.com in Resend (adds an MX record), add an
            email.received webhook pointing to /api/webhooks/resend-inbound, set
            RESEND_WEBHOOK_SECRET, and set OUTREACH_REPLY_TO=reply@contact.twinmile.com.
          </span>
        </div>
      )}
      <Pager {...meta} makeHref={makeHref} />
      {replies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No replies captured yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {replies.map((r) => (
            <ReplyCard key={r.id} reply={r} onSent={onSent} />
          ))}
          <Pager {...meta} makeHref={makeHref} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────

export function OutreachDashboard({
  initialData,
  initialTab = "sent",
}: {
  initialData: OutreachDashboardData;
  initialTab?: "sent" | "replies";
}) {
  const [replies, setReplies] = React.useState<ReplyRow[]>(initialData.replies.rows);

  // Server-side pagination re-renders the page with a new rows slice; keep the
  // optimistic client copy in sync when that happens.
  React.useEffect(() => {
    setReplies(initialData.replies.rows);
  }, [initialData.replies.rows]);

  const handleSent = (id: string, sentAt: string) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "responded", responseSentAt: sentAt } : r))
    );
  };

  const pendingDrafts = replies.filter(
    (r) => r.draftResponse && r.status !== "responded" && !r.responseSentAt
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Every outreach email — who we contacted, exactly what they saw, and their replies.
          </p>
        </div>
        <Link
          href="/admin/lead-engine"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Pipeline view → Recruiting Pipeline
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <StatChips stats={initialData.emailStats} />

      <Tabs defaultValue={initialTab}>
        <TabsList aria-label="Email views">
          <TabsTrigger value="sent">
            Emails ({initialData.sent.total.toLocaleString()})
          </TabsTrigger>
          <TabsTrigger value="replies">
            Replies ({initialData.replies.total.toLocaleString()}
            {pendingDrafts > 0 ? `, ${pendingDrafts} to answer` : ""})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sent">
          <SentEmailsTab data={initialData} />
        </TabsContent>
        <TabsContent value="replies">
          <RepliesTab
            replies={replies}
            meta={{
              total: initialData.replies.total,
              page: initialData.replies.page,
              pageCount: initialData.replies.pageCount,
              pageSize: initialData.replies.pageSize,
            }}
            statusFilter={initialData.statusFilter}
            inboundConfigured={initialData.inboundConfigured}
            replyToInUse={initialData.replyToInUse}
            onSent={handleSent}
          />
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground">
        Note: until RESEND_FROM_EMAIL is set to a verified twinmile.com sender in Resend, real
        inboxes show the sender as onboarding@resend.dev.
      </p>
    </div>
  );
}
