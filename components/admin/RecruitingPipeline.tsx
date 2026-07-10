"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Zap,
  Target,
  Mail,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  BarChart3,
} from "lucide-react";
import { PipelineFunnel } from "@/components/admin/PipelineFunnel";
import { Pager } from "@/components/admin/Pager";
import { AdminInbox } from "@/components/admin/admin-inbox";
import { stageDef, type PipelineCounts, type QuoteStageCounts } from "@/lib/pipeline-stages";

/**
 * Recruiting Pipeline — THE one pipeline page.
 * Replaces /admin/pipeline, /admin/inbox, and /admin/dashboard/recruiting.
 * Fed exclusively by getPipelineCounts() + paginated newest-first lists.
 */

export interface ProspectRow {
  id: string;
  name: string;
  dotNumber: string;
  location: string;
  aiScore: number;
  status: string;
  stage: { key: string; label: string; hex: string };
  source: string;
  phone: string;
  email: string;
  equipment: string;
  powerUnits: number;
  drivers: number;
  safetyRating: string;
  authorityStatus: string;
  interestSignals: string[];
  sourceUrl: string;
  createdAt: string;
  invitedAt: string;
}

export interface EngagedRow {
  id: string;
  leadName: string;
  leadEmail: string;
  status: string;
  currentStep: number;
  firstClickedAt: string;
  createdAt: string;
  onboardingUrl: string;
}

export interface ActivityRow {
  id: string;
  action: string;
  actionLabel: string;
  agent: string;
  agentRole: string;
  summary: string;
  details: unknown;
  success: boolean;
  timestamp: string;
}

interface PageMeta {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export type PipelineTab = "prospects" | "manual" | "engaged" | "activity";

interface RecruitingPipelineProps {
  counts: PipelineCounts;
  quotes: QuoteStageCounts;
  tab: PipelineTab;
  prospects: PageMeta & { rows: ProspectRow[] };
  engaged: EngagedRow[];
  activity: PageMeta & { rows: ActivityRow[] };
  manualQuoteLeads: React.ComponentProps<typeof AdminInbox>["quoteLeads"];
  manualDriverLeads: React.ComponentProps<typeof AdminInbox>["driverLeads"];
}

function fmtCT(iso: string, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function RecruitingPipeline({
  counts,
  quotes,
  tab,
  prospects,
  engaged,
  activity,
  manualQuoteLeads,
  manualDriverLeads,
}: RecruitingPipelineProps) {
  // Canonical stage rows (labels + hexes travel with the counts from
  // lib/pipeline-stages.ts — never redefined here).
  const stageByKey = new Map(counts.stages.map((s) => [s.key, s]));
  const sourcedStage = stageByKey.get("sourced");
  const qualifiedStage = stageByKey.get("qualified");
  const invitedStage = stageByKey.get("invited");
  const engagedStage = stageByKey.get("engaged");

  const TABS: { key: PipelineTab; label: string; count: number }[] = [
    { key: "prospects", label: "Prospects", count: prospects.total },
    { key: "manual", label: "Applications & quotes", count: manualQuoteLeads.length + manualDriverLeads.length },
    { key: "engaged", label: "Engaged", count: engaged.length },
    { key: "activity", label: "Activity", count: activity.total },
  ];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-6 w-6 text-primary" />
            Recruiting Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.totals.prospects.toLocaleString()} prospects ·{" "}
            {counts.totals.driverLeads.toLocaleString()} driver applications · every list newest
            first, every number a real total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/outreach" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Mail className="h-4 w-4" />
            Emails
          </Link>
          <Link href="/admin/agents" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Users className="h-4 w-4" />
            Agents
          </Link>
        </div>
      </div>

      {/* Headline chips — labels and hexes come straight from the canonical
          taxonomy (lib/pipeline-stages.ts); nothing is redefined here. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sourcedStage && (
          <HeadlineChip label={sourcedStage.label} value={sourcedStage.reached} hex={sourcedStage.hex} />
        )}
        {qualifiedStage && (
          <HeadlineChip
            label={capitalizeFirst(qualifiedStage.inStageLabel)}
            value={qualifiedStage.inStage}
            hex={qualifiedStage.hex}
          />
        )}
        {invitedStage && (
          <HeadlineChip label={invitedStage.label} value={invitedStage.reached} hex={invitedStage.hex} />
        )}
        {engagedStage && (
          <HeadlineChip label={engagedStage.label} value={engagedStage.reached} hex={engagedStage.hex} />
        )}
      </div>

      {/* THE funnel */}
      <PipelineFunnel counts={counts} />

      {/* Quote pipeline (small, separate business) */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Quote pipeline (freight customers)
            </span>
            <Badge variant="outline" className="text-xs">{quotes.total.toLocaleString()} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {quotes.stages.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.hex }} />
                <span className="font-semibold tabular-nums">{s.count.toLocaleString()}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid gap-2 sm:grid-cols-2">
        <QuickActionButton
          icon={<Target className="h-5 w-5" />}
          color="bg-cyan-600"
          title="Run FMCSA prospecting"
          subtitle="Sofia finds new real owner-operators"
          onClick={() => triggerAction("/api/admin/fmcsa-prospecting", "POST", { maxResults: 30 })}
        />
        <QuickActionButton
          icon={<Zap className="h-5 w-5" />}
          color="bg-purple-600"
          title="Run daily ops"
          subtitle="Process all pending actions"
          onClick={() => triggerAction("/api/admin/ops", "POST", { action: "daily_ops" })}
        />
      </div>

      {/* Tabs (links — pagination is server-side) */}
      <div>
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/60">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/lead-engine?tab=${t.key}`}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} ({t.count.toLocaleString()})
            </Link>
          ))}
        </div>

        {tab === "prospects" && <ProspectsTab prospects={prospects} />}
        {tab === "manual" && (
          <AdminInbox quoteLeads={manualQuoteLeads} driverLeads={manualDriverLeads} />
        )}
        {tab === "engaged" && <EngagedTab rows={engaged} />}
        {tab === "activity" && <ActivityTab activity={activity} />}
      </div>
    </div>
  );
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function HeadlineChip({ label, value, hex }: { label: string; value: number; hex: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3.5">
        <div className="text-2xl font-bold tabular-nums" style={{ color: hex }}>
          {value.toLocaleString()}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospects tab — paginated, newest first, canonical stage badges
// ─────────────────────────────────────────────────────────────────────────────

function ProspectsTab({ prospects }: { prospects: PageMeta & { rows: ProspectRow[] } }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const makeHref = (page: number) => `/admin/lead-engine?tab=prospects&page=${page}`;

  return (
    <div className="space-y-3">
      <Pager {...prospects} makeHref={makeHref} />
      {prospects.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No prospects yet — run FMCSA prospecting above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {prospects.rows.map((p) => (
            <ProspectRowItem
              key={p.id}
              prospect={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
            />
          ))}
        </div>
      )}
      <Pager {...prospects} makeHref={makeHref} />
    </div>
  );
}

function ProspectRowItem({
  prospect,
  expanded,
  onToggle,
}: {
  prospect: ProspectRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreColor =
    prospect.aiScore >= 90 ? "text-emerald-500" : prospect.aiScore >= 75 ? "text-amber-500" : "text-muted-foreground";

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <button onClick={onToggle} className="w-full p-3 text-left transition-colors hover:bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={cn("w-10 text-center text-lg font-bold tabular-nums", scoreColor)}>
              {prospect.aiScore || "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{prospect.name}</span>
                {prospect.dotNumber && (
                  <Badge variant="outline" className="text-[10px]">DOT {prospect.dotNumber}</Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {[prospect.location, prospect.equipment].filter(Boolean).join(" · ")}
                {" · added "}
                {fmtCT(prospect.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
              style={{ color: prospect.stage.hex, borderColor: `${prospect.stage.hex}55`, backgroundColor: `${prospect.stage.hex}14` }}
            >
              {prospect.stage.label}
            </span>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 bg-muted/10 p-3">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <InfoRow label="AI score" value={`${prospect.aiScore}/100`} />
            <InfoRow label="Pipeline stage" value={prospect.stage.label} />
            <InfoRow label="Phone" value={prospect.phone || "Not available"} />
            <InfoRow label="Email" value={prospect.email || "Not available"} />
            <InfoRow label="Power units" value={String(prospect.powerUnits || "—")} />
            <InfoRow label="Drivers" value={String(prospect.drivers || "—")} />
            <InfoRow label="Safety rating" value={prospect.safetyRating || "Not rated"} />
            <InfoRow label="Authority" value={prospect.authorityStatus || "Unknown"} />
            <InfoRow label="Source" value={prospect.source || "FMCSA"} />
            <InfoRow label="Added" value={fmtCT(prospect.createdAt, true) + " CT"} />
            {prospect.invitedAt && (
              <InfoRow
                label={stageDef("invited").shortLabel}
                value={fmtCT(prospect.invitedAt, true) + " CT"}
              />
            )}
          </div>

          {prospect.interestSignals && prospect.interestSignals.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Interest signals</p>
              <div className="flex flex-wrap gap-1">
                {prospect.interestSignals.map((sig, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{sig}</Badge>
                ))}
              </div>
            </div>
          )}

          {prospect.sourceUrl && (
            <a
              href={prospect.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on FMCSA SAFER
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Engaged tab — the 7 warmest leads (clicked their link)
// ─────────────────────────────────────────────────────────────────────────────

function EngagedTab({ rows }: { rows: EngagedRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nobody has clicked their onboarding link yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Everyone who opened their onboarding link — newest click first. These are the warmest leads.
      </p>
      {rows.map((s) => (
        <div key={s.id} className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <UserCheck className="h-4 w-4 shrink-0 text-violet-400" />
                <span className="truncate text-sm font-medium">{s.leadName}</span>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {s.status.replace(/_/g, " ")}
                </Badge>
                {s.currentStep > 1 && (
                  <Badge variant="outline" className="text-[10px]">step {s.currentStep}</Badge>
                )}
              </div>
              <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                <p>{s.leadEmail || "No email"}</p>
                <p>
                  Clicked {fmtCT(s.firstClickedAt || s.createdAt, true)} CT · invited{" "}
                  {fmtCT(s.createdAt)}
                </p>
              </div>
            </div>
            {s.onboardingUrl && (
              <a
                href={s.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Portal
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity tab — paginated, newest first, real total
// ─────────────────────────────────────────────────────────────────────────────

function ActivityTab({ activity }: { activity: PageMeta & { rows: ActivityRow[] } }) {
  const makeHref = (page: number) => `/admin/lead-engine?tab=activity&page=${page}`;
  return (
    <div className="space-y-3">
      <Pager {...activity} makeHref={makeHref} />
      <div className="space-y-2">
        {activity.rows.map((a) => (
          <ActivityRowItem key={a.id} activity={a} />
        ))}
      </div>
      <Pager {...activity} makeHref={makeHref} />
    </div>
  );
}

function ActivityRowItem({ activity: a }: { activity: ActivityRow }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-2 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start gap-2">
          <div className={cn("mt-0.5 shrink-0", a.success ? "text-emerald-500" : "text-red-500")}>
            {a.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">{a.agent}</span>
              <Badge variant="secondary" className="text-[9px]">{a.actionLabel}</Badge>
              <span className="ml-auto text-[9px] text-muted-foreground">
                {fmtCT(a.timestamp, true)} CT
              </span>
            </div>
            {a.summary && !expanded && (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{a.summary}</p>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/40 bg-background/40 p-3">
          {a.summary && <p className="mb-2 rounded bg-muted/40 p-2 text-xs">{a.summary}</p>}
          {a.details != null && (
            <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[10px] font-mono">
              {JSON.stringify(a.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions
// ─────────────────────────────────────────────────────────────────────────────

function QuickActionButton({
  icon,
  color,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  onClick: () => Promise<unknown>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      await onClick();
      setResult("Started successfully");
    } catch (err: unknown) {
      setResult(err instanceof Error ? `Failed: ${err.message}` : "Failed");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white", color)}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{result || subtitle}</p>
      </div>
    </button>
  );
}

async function triggerAction(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  return res.json();
}
