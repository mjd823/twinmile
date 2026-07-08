"use client";

import * as React from "react";
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
  ChevronRight,
} from "lucide-react";
import type { OutreachDashboardData, SentEmailRow, ReplyRow } from "@/lib/outreach-data";

function fmt(dateIso: string): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  failed: "border-red-500/30 bg-red-500/10 text-red-500",
  retrying: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  pending: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  sending: "border-sky-500/30 bg-sky-500/10 text-sky-500",
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

const FUNNEL_STAGES: {
  key: keyof OutreachDashboardData["funnel"];
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "new", label: "New", icon: Sparkles },
  { key: "reviewed", label: "Reviewed", icon: CheckCircle2 },
  { key: "invited", label: "Invited", icon: Mail },
  { key: "clicked", label: "Clicked", icon: MousePointerClick },
  { key: "replied", label: "Replied", icon: Reply },
  { key: "onboarded", label: "Onboarded", icon: UserCheck },
];

function FunnelHeader({ funnel }: { funnel: OutreachDashboardData["funnel"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {FUNNEL_STAGES.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <Card key={stage.key} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {stage.label}
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {funnel[stage.key]}
              </div>
              {i < FUNNEL_STAGES.length - 1 && (
                <ChevronRight className="absolute right-1 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/40 lg:block" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineStep({
  label,
  at,
  icon: Icon,
}: {
  label: string;
  at: string;
  icon: React.ElementType;
}) {
  const done = Boolean(at);
  return (
    <div className="flex items-center gap-2">
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
      <div className="min-w-0">
        <div className={cn("text-xs font-medium", !done && "text-muted-foreground/60")}>
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground">{fmt(at)}</div>
      </div>
    </div>
  );
}

function EmailDetailDialog({
  email,
  onClose,
}: {
  email: SentEmailRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(email)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {email && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{email.subject || "(no subject)"}</DialogTitle>
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
              <span>
                ·{" "}
                {email.bodySource === "persisted"
                  ? "exact copy as sent"
                  : email.bodySource === "rendered"
                    ? "re-rendered from template (sent before copies were stored)"
                    : "content unavailable"}
              </span>
            </div>

            {email.status === "failed" && email.error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Failed after {email.attempts} attempt{email.attempts === 1 ? "" : "s"}: {email.error}
                </span>
              </div>
            )}

            <div className="rounded-md border border-border/60 bg-muted/30 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email body
              </div>
              {email.body ? (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                  {email.body}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Body not available for this task.</p>
              )}
            </div>

            <div className="rounded-md border border-border/60 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prospect timeline
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TimelineStep label="Email sent" at={email.sentAt} icon={Mail} />
                <TimelineStep label="Onboarding invited" at={email.timeline.invitedAt} icon={UserCheck} />
                <TimelineStep label="Link clicked" at={email.timeline.clickedAt} icon={MousePointerClick} />
                <TimelineStep label="Replied" at={email.timeline.repliedAt} icon={Reply} />
              </div>
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

function SentEmailsTab({ emails }: { emails: SentEmailRow[] }) {
  const [selected, setSelected] = React.useState<SentEmailRow | null>(null);

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No outreach emails yet. Tasks queued by the agents will show here once processed.
        </CardContent>
      </Card>
    );
  }

  return (
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
            {emails.map((e) => (
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
                  {fmt(e.sentAt || e.scheduledAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {emails.map((e) => (
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
              {fmt(e.sentAt || e.scheduledAt)}
            </div>
          </button>
        ))}
      </div>

      <EmailDetailDialog email={selected} onClose={() => setSelected(null)} />
    </>
  );
}

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
            <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
              {reply.draftResponse.text}
            </pre>
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
  inboundConfigured,
  replyToInUse,
  onSent,
}: {
  replies: ReplyRow[];
  inboundConfigured: boolean;
  replyToInUse: string;
  onSent: (id: string, sentAt: string) => void;
}) {
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
      {replies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No replies captured yet.
          </CardContent>
        </Card>
      ) : (
        replies.map((r) => <ReplyCard key={r.id} reply={r} onSent={onSent} />)
      )}
    </div>
  );
}

export function OutreachDashboard({ initialData }: { initialData: OutreachDashboardData }) {
  const [replies, setReplies] = React.useState<ReplyRow[]>(initialData.replies);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outreach</h1>
        <p className="text-sm text-muted-foreground">
          Who we emailed, exactly what each email said, where every prospect sits, and their
          replies.
        </p>
      </div>

      <FunnelHeader funnel={initialData.funnel} />

      <Tabs defaultValue="sent">
        <TabsList aria-label="Outreach views">
          <TabsTrigger value="sent">
            Sent emails ({initialData.sentEmails.length})
          </TabsTrigger>
          <TabsTrigger value="replies">
            Replies ({replies.length}
            {pendingDrafts > 0 ? `, ${pendingDrafts} to answer` : ""})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sent">
          <SentEmailsTab emails={initialData.sentEmails} />
        </TabsContent>
        <TabsContent value="replies">
          <RepliesTab
            replies={replies}
            inboundConfigured={initialData.inboundConfigured}
            replyToInUse={initialData.replyToInUse}
            onSent={handleSent}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
