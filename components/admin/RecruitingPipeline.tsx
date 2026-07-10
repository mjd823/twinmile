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
  HelpCircle,
  Loader2,
  CheckCircle2,
  RefreshCw,
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
export type ProspectFilter = "all" | "below75";

interface RecruitingPipelineProps {
  counts: PipelineCounts;
  quotes: QuoteStageCounts;
  tab: PipelineTab;
  prospectFilter: ProspectFilter;
  outreachPaused: boolean;
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
  prospectFilter,
  outreachPaused,
  prospects,
  engaged,
  activity,
  manualQuoteLeads,
  manualDriverLeads,
}: RecruitingPipelineProps) {
  // Tabs are pure CLIENT state: all four tabs' data is already in props, so
  // switching needs zero server work. The URL is kept in sync with
  // history.replaceState (no router navigation = no scroll-to-top jump).
  const [activeTab, setActiveTab] = React.useState<PipelineTab>(tab);
  React.useEffect(() => setActiveTab(tab), [tab]);
  const switchTab = (key: PipelineTab) => {
    setActiveTab(key);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/admin/lead-engine?tab=${key}`);
    }
  };

  // Canonical stage rows (labels + hexes travel with the counts from
  // lib/pipeline-stages.ts — never redefined here).
  const stageByKey = new Map(counts.stages.map((s) => [s.key, s]));
  const sourcedStage = stageByKey.get("sourced");
  const qualifiedStage = stageByKey.get("qualified");
  const invitedStage = stageByKey.get("invited");
  const engagedStage = stageByKey.get("engaged");
  const below75 = counts.offFunnel.find((b) => b.key === "unqualified");

  const TABS: { key: PipelineTab; label: string; count: number; subtitle: string }[] = [
    {
      key: "prospects",
      label: "Prospects",
      count: prospects.total,
      subtitle:
        "Every carrier Sofia has found in the FMCSA database — the outreach funnel above is built from this list.",
    },
    {
      key: "manual",
      label: "Applications & quotes",
      count: manualQuoteLeads.length + manualDriverLeads.length,
      subtitle:
        "People who contacted US through the website — driver applications and freight-quote requests. This is a separate source from the outreach funnel above (driver applications do count in the funnel totals; quote requests belong to the freight-customer pipeline).",
    },
    {
      key: "engaged",
      label: "Engaged",
      count: engaged.length,
      subtitle:
        "People WE emailed who clicked their onboarding link — the warmest outreach leads. Not related to the website applications tab.",
    },
    {
      key: "activity",
      label: "Activity",
      count: activity.total,
      subtitle: "Everything the AI agents did, newest first. Tap a row for the details in plain English.",
    },
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

      {/* Plain-English explainer — what each stage means, how someone moves
          forward, and the honest story for the below-75 bucket. */}
      <HowItWorks below75Count={below75?.count ?? 0} outreachPaused={outreachPaused} />

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

      {/* Tabs — client-side switching (all tab data is already loaded), so
          the page never jumps to the top or refetches. Pagination inside a
          tab is still server-side via scroll-preserving links. */}
      <div>
        <div className="flex gap-1 overflow-x-auto border-b border-border/60">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} ({t.count.toLocaleString()})
            </button>
          ))}
        </div>
        <p className="mb-4 mt-2 text-xs text-muted-foreground">
          {TABS.find((t) => t.key === activeTab)?.subtitle}
        </p>

        {activeTab === "prospects" && (
          <ProspectsTab prospects={prospects} filter={prospectFilter} below75Count={below75?.count ?? 0} />
        )}
        {activeTab === "manual" && (
          <AdminInbox quoteLeads={manualQuoteLeads} driverLeads={manualDriverLeads} />
        )}
        {activeTab === "engaged" && <EngagedTab rows={engaged} />}
        {activeTab === "activity" && <ActivityTab activity={activity} />}
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
// "How this pipeline works" — the plain-English story, incl. the honest
// answer for the below-75 bucket (they are NEVER re-scored automatically).
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks({
  below75Count,
  outreachPaused,
}: {
  below75Count: number;
  outreachPaused: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const steps: { title: string; body: string }[] = [
    {
      title: `${stageDef("sourced").shortLabel} — we found them`,
      body: "Sofia searches the official FMCSA database (real government data) every day and pulls in real owner-operators. Each one is scored 0–100 on whether we can reach them, fleet size, miles run, and operating authority.",
    },
    {
      title: `${stageDef("qualified").shortLabel} — worth pursuing`,
      body: "A score of 75 or higher makes a prospect qualified automatically. Nobody moves forward without hitting 75.",
    },
    {
      title: `${stageDef("invited").shortLabel} — we emailed them`,
      body: outreachPaused
        ? "Qualified prospects get an email with their personal onboarding link. Sending is PAUSED right now (your call) — invites queue up and go out once outreach is switched back on."
        : "Qualified prospects automatically get an email with their personal onboarding link.",
    },
    {
      title: `${stageDef("engaged").shortLabel} — they clicked`,
      body: "Anyone who opens their onboarding link becomes engaged. These are the warmest leads — worth a personal call.",
    },
    {
      title: `${stageDef("docs").shortLabel} → ${stageDef("completed").shortLabel} → ${stageDef("hired").shortLabel}`,
      body: "They upload CDL, insurance, and W-9, finish onboarding, sign a lease, and start driving with Twin Mile.",
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-primary" />
          How this pipeline works — and what happens to prospects under 75
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/50 p-4">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* The below-75 story — honest, with a REAL way to act on it. */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
            <p className="text-sm font-medium">
              What about the {below75Count.toLocaleString()} under 75?
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              They stay parked at “{stageDef("sourced").shortLabel}”. Straight answer: scoring
              happens <span className="font-medium text-foreground">once</span>, when a prospect is
              first found — nothing re-scores them automatically, so without action they sit there
              forever. Their FMCSA record does change over time (a new phone or email, more trucks,
              a fresh filing can lift the score past 75), so you can re-check them against
              today&apos;s FMCSA data:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <RescoreButton />
              <Link
                href="/admin/lead-engine?tab=prospects&filter=below75"
                scroll={false}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                See the under-75 list
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Real re-score: POSTs to /api/admin/rescore-prospects, which re-fetches each
 * carrier's CURRENT record from the FMCSA Census API and re-runs the scoring
 * rubric (recorded in scoreHistory). Not a fake button.
 */
function RescoreButton() {
  const [state, setState] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");

  const run = async () => {
    setState("running");
    setMessage("");
    try {
      const res = await fetch("/api/admin/rescore-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setState("done");
      setMessage(
        `Re-scored ${data.rescored} against fresh FMCSA data — ${data.newlyQualified} newly qualified, ${data.scoreChanged} score${data.scoreChanged === 1 ? "" : "s"} changed${data.notFound > 0 ? `, ${data.notFound} no longer in the FMCSA registry` : ""}. Refresh to see updates.`
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Re-score failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {state === "running" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking fresh FMCSA data…
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-score 50 oldest with fresh FMCSA data
          </>
        )}
      </button>
      {message && (
        <span
          className={cn(
            "text-xs",
            state === "error" ? "text-red-400" : "text-emerald-400"
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospects tab — paginated, newest first, canonical stage badges
// ─────────────────────────────────────────────────────────────────────────────

function ProspectsTab({
  prospects,
  filter,
  below75Count,
}: {
  prospects: PageMeta & { rows: ProspectRow[] };
  filter: ProspectFilter;
  below75Count: number;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const filterParam = filter === "below75" ? "&filter=below75" : "";
  const makeHref = (page: number) => `/admin/lead-engine?tab=prospects&page=${page}${filterParam}`;

  return (
    <div className="space-y-3">
      {/* Filter chips — the below-75 bucket finally has its own view. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip href="/admin/lead-engine?tab=prospects" active={filter === "all"}>
          All prospects
        </FilterChip>
        <FilterChip
          href="/admin/lead-engine?tab=prospects&filter=below75"
          active={filter === "below75"}
        >
          Below score 75 ({below75Count.toLocaleString()})
        </FilterChip>
        {filter === "below75" && (
          <span className="text-[11px] text-muted-foreground">
            — parked at “{stageDef("sourced").shortLabel}” until a re-score lifts them past 75
          </span>
        )}
      </div>
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

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
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

// ── Humanized activity details ───────────────────────────────────────────────
// Expanded rows used to dump raw JSON. Each known action type now renders a
// plain-English sentence + key facts; the raw JSON survives behind a
// collapsed "Raw data" toggle for debugging.

const HIDDEN_DETAIL_KEYS = new Set([
  "taskId",
  "leadId",
  "sessionToken",
  "id",
  "_id",
  "source",
  "renderedHtml",
  "renderedBody",
]);

const FRIENDLY_KEY_LABELS: Record<string, string> = {
  leadName: "Lead",
  leadEmail: "Email",
  leadType: "Lead type",
  template: "Email template",
  channel: "Channel",
  status: "Status",
  attempts: "Attempts",
  priority: "Priority",
  sentAt: "Sent at",
  firstClick: "First click",
  scanned: "Posts scanned",
  surfaced: "Leads surfaced",
  inserted: "Leads saved",
  rateLimited: "Rate limited",
  compliance: "Compliance mode",
  carriersFound: "Carriers found",
  qualified: "Scored 75+",
  saved: "New prospects saved",
  targetStates: "States searched",
  rescored: "Re-scored",
  newlyQualified: "Newly qualified",
  scoreChanged: "Scores changed",
  notFound: "Not in FMCSA anymore",
  prospects: "New prospects",
  outreachTasks: "Pending outreach",
  driverLeads: "New driver applications",
  error: "Error",
};

function looksLikeIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
}

function prettifyKey(key: string): string {
  const label = FRIENDLY_KEY_LABELS[key];
  if (label) return label;
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") {
    if (looksLikeIsoDate(v)) return `${fmtCT(v, true)} CT`;
    return v.length > 140 ? `${v.slice(0, 140)}…` : v;
  }
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) {
    return v.slice(0, 8).join(", ") + (v.length > 8 ? "…" : "");
  }
  return null; // nested objects handled by the flattener
}

/** Flatten details into human-readable facts (one nested level deep). */
function detailFacts(details: unknown): { label: string; value: string }[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const facts: { label: string; value: string }[] = [];
  const walk = (obj: Record<string, unknown>, depth: number) => {
    for (const [key, val] of Object.entries(obj)) {
      if (facts.length >= 14) return;
      if (HIDDEN_DETAIL_KEYS.has(key)) continue;
      const v = humanValue(val);
      if (v !== null) {
        facts.push({ label: prettifyKey(key), value: v });
      } else if (depth < 1 && val && typeof val === "object" && !Array.isArray(val)) {
        walk(val as Record<string, unknown>, depth + 1);
      }
    }
  };
  walk(details as Record<string, unknown>, 0);
  return facts;
}

/** Plain-English one-liner for the action types we know. */
function activitySentence(a: ActivityRow): string | null {
  const d = (a.details && typeof a.details === "object" ? a.details : {}) as Record<string, any>;
  const name = d.leadName || d.name;
  const email = d.leadEmail || d.email;
  const who = name ? `${name}${email ? ` (${email})` : ""}` : email || null;

  switch (a.action) {
    case "onboarding_invite":
    case "auto_onboarding_invite":
      return who
        ? `Invited ${who} — onboarding email ${d.status === "sent" || d.result?.success ? "sent" : d.status || "queued"}.`
        : "Sent an onboarding invitation.";
    case "onboarding_link_clicked":
      return who
        ? `${who} clicked their onboarding link${d.firstClick ? " for the first time" : ""} — warm lead.`
        : "A prospect clicked their onboarding link.";
    case "prospect_reply_received":
      return who ? `${who} replied to our outreach email.` : "A prospect replied to our outreach.";
    case "fmcsa_prospecting":
    case "outbound_prospecting": {
      const found = d.carriersFound ?? d.found;
      const saved = d.saved ?? d.prospectsSaved;
      if (found !== undefined || saved !== undefined) {
        return `Searched the FMCSA database: found ${Number(found ?? 0).toLocaleString()} real carriers, ${Number(d.qualified ?? 0).toLocaleString()} scored 75+, saved ${Number(saved ?? 0).toLocaleString()} new prospects.`;
      }
      return null;
    }
    case "prospect_rescore":
      return `Re-checked ${Number(d.rescored ?? 0).toLocaleString()} below-75 prospects against fresh FMCSA data — ${Number(d.newlyQualified ?? 0).toLocaleString()} newly qualified.`;
    case "social_listening":
      return `Scanned ${Number(d.scanned ?? 0).toLocaleString()} social posts, surfaced ${Number(d.surfaced ?? 0).toLocaleString()}, saved ${Number(d.inserted ?? 0).toLocaleString()} as leads.`;
    case "supervisor_monitoring": {
      const n = Array.isArray(d.bottlenecks) ? d.bottlenecks.length : null;
      return n === null
        ? "Wrote the daily supervisor report."
        : `Wrote the daily supervisor report — ${n === 0 ? "no issues flagged" : `${n} finding${n === 1 ? "" : "s"} flagged`}.`;
    }
    case "daily_ops":
      return null; // its `activity` string is already the summary shown above
    default:
      return null;
  }
}

function ActivityRowItem({ activity: a }: { activity: ActivityRow }) {
  const [expanded, setExpanded] = React.useState(false);
  const sentence = activitySentence(a);
  const facts = expanded ? detailFacts(a.details) : [];
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
            {(sentence || a.summary) && !expanded && (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {sentence || a.summary}
              </p>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="space-y-2.5 border-t border-border/40 bg-background/40 p-3">
          {(sentence || a.summary) && (
            <p className="text-xs leading-relaxed">{sentence || a.summary}</p>
          )}
          {sentence && a.summary && a.summary !== sentence && (
            <p className="text-xs leading-relaxed text-muted-foreground">{a.summary}</p>
          )}
          {facts.length > 0 && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {facts.map((f, i) => (
                <InfoRow key={i} label={f.label} value={f.value} />
              ))}
            </div>
          )}
          {a.details != null && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] text-muted-foreground/70 hover:text-muted-foreground">
                Raw data (for debugging)
              </summary>
              <pre className="mt-1.5 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[10px] font-mono">
                {JSON.stringify(a.details, null, 2)}
              </pre>
            </details>
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
