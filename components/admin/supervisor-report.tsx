import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stageDef } from "@/lib/pipeline-stages";
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  Mail,
  Truck,
  Timer,
  ClipboardList,
} from "lucide-react";

/**
 * "Supervisor's Daily Report" — renders the latest agent_activity doc with
 * action "supervisor_monitoring" (written daily by /api/cron/supervisor-report).
 *
 * DEFENSIVE by design: the report shape has already changed once (the old
 * manual supervisor_run.cjs wrote a different structure) and will evolve
 * again. Every accessor tolerates missing/renamed fields.
 */

interface SupervisorReportPanelProps {
  /** result payload of the latest supervisor_monitoring doc (unknown shape) */
  result: Record<string, unknown> | null;
  /** ISO timestamp the report was generated, or null when none exists */
  generatedAt: string | null;
  /** whether the run itself succeeded (agent_activity.success) */
  runSucceeded: boolean;
}

// ── Defensive accessors ──────────────────────────────────────────────────────

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function fmt(v: number | null): string {
  return v === null ? "—" : String(v);
}

interface Finding {
  severity: "critical" | "warning" | "info";
  text: string;
}

/** Pull a blunt findings list out of whatever shape the report uses. */
function extractFindings(result: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];

  // Current shape: bottlenecks: [{ severity, description }]
  if (Array.isArray(result.bottlenecks)) {
    for (const b of result.bottlenecks) {
      const bo = obj(b);
      const text = typeof bo.description === "string" ? bo.description : null;
      if (text)
        findings.push({
          severity: bo.severity === "critical" ? "critical" : "warning",
          text,
        });
    }
  }
  // Legacy shape: bottleneck: string (+ bottleneckSeverity)
  if (typeof result.bottleneck === "string" && result.bottleneck.trim()) {
    findings.push({
      severity: result.bottleneckSeverity === "critical" ? "critical" : "warning",
      text: result.bottleneck,
    });
  }
  // Legacy shape: errors: [{ severity, description }]
  if (Array.isArray(result.errors)) {
    for (const e of result.errors) {
      const eo = obj(e);
      const text =
        typeof eo.description === "string"
          ? eo.description
          : typeof e === "string"
            ? e
            : null;
      if (text)
        findings.push({
          severity:
            String(eo.severity).toUpperCase() === "CRITICAL"
              ? "critical"
              : "warning",
          text,
        });
    }
  }
  // Recommendations (either shape)
  if (Array.isArray(result.recommendations)) {
    for (const r of result.recommendations) {
      if (typeof r === "string" && r.trim())
        findings.push({ severity: "info", text: r });
    }
  }
  return findings;
}

// ── Tiles ────────────────────────────────────────────────────────────────────

function Tile({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3 flex items-start gap-2.5 min-w-0">
      <div className="h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground truncate">
          {label}
        </p>
        <p className={`text-xl font-bold leading-tight tabular-nums ${toneClass}`}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

const SEVERITY_STYLES: Record<Finding["severity"], { pill: string; label: string }> = {
  critical: { pill: "bg-red-500/15 text-red-400 border-red-500/30", label: "Critical" },
  warning: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Warning" },
  info: { pill: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Action" },
};

// ── Component ────────────────────────────────────────────────────────────────

export function SupervisorReportPanel({
  result,
  generatedAt,
  runSucceeded,
}: SupervisorReportPanelProps) {
  if (!result) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Supervisor&apos;s Daily Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No report yet. The AI Supervisor writes one daily at 7:00 AM CT
            (cron <span className="font-mono text-xs">0 12 * * *</span> UTC).
          </p>
        </CardContent>
      </Card>
    );
  }

  const pipeline = obj(result.pipeline);
  const outreach = obj(result.outreach ?? result.outreachSystem);
  const fleet = obj(result.fleet);
  const cronHealth = obj(result.cronHealth);
  const findings = extractFindings(result);
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const severity =
    typeof result.bottleneckSeverity === "string"
      ? result.bottleneckSeverity
      : criticalCount > 0
        ? "critical"
        : findings.length > 0
          ? "warning"
          : "none";

  const cronHealthy = num(cronHealth.healthy);
  const cronTotal = num(cronHealth.totalJobs);
  const cronBad =
    (num(cronHealth.stale) ?? 0) +
    (num(cronHealth.error) ?? 0) +
    (num(cronHealth.critical) ?? 0) +
    (num(cronHealth.neverRan) ?? 0);

  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) + " CT"
    : "unknown";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Supervisor&apos;s Daily Report
          </CardTitle>
          <div className="flex items-center gap-2">
            {severity === "critical" ? (
              <Badge className="border-transparent bg-red-500/15 text-red-400 gap-1">
                <AlertCircle className="h-3 w-3" />
                Critical bottleneck
              </Badge>
            ) : severity === "warning" ? (
              <Badge className="border-transparent bg-amber-500/15 text-amber-400 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Needs attention
              </Badge>
            ) : (
              <Badge className="border-transparent bg-emerald-500/15 text-emerald-400 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Healthy
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Generated {generatedLabel}
          {!runSucceeded && (
            <span className="text-red-400"> · last run reported a failure</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Tiles ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Tile
            icon={<Users className="h-4 w-4" />}
            label="Prospects"
            value={fmt(num(pipeline.totalProspects))}
            sub={`${fmt(num(pipeline.qualified))} qualified`}
          />
          <Tile
            icon={<ClipboardList className="h-4 w-4" />}
            label={stageDef("invited").shortLabel}
            value={fmt(num(pipeline.onboardingInvited))}
            sub={
              num(pipeline.qualifiedNotInvited) !== null
                ? `${fmt(num(pipeline.qualifiedNotInvited))} awaiting invite`
                : undefined
            }
            tone={(num(pipeline.qualifiedNotInvited) ?? 0) > 0 ? "warn" : "default"}
          />
          <Tile
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={stageDef("completed").shortLabel}
            value={fmt(num(pipeline.onboardingCompleted ?? pipeline.documentsSubmitted))}
            sub={
              num(pipeline.onboardingSessions) !== null
                ? `of ${fmt(num(pipeline.onboardingSessions))} sessions`
                : "completed"
            }
          />
          <Tile
            icon={<Mail className="h-4 w-4" />}
            label="Outreach 24h"
            value={fmt(num(outreach.sentLast24h ?? outreach.sent))}
            sub={`${fmt(num(outreach.pending))} pending · ${fmt(num(outreach.failed))} failed`}
            tone={(num(outreach.failed) ?? 0) > 0 ? "warn" : "default"}
          />
          <Tile
            icon={<Truck className="h-4 w-4" />}
            label="Fleet"
            value={fmt(num(fleet.trucks))}
            sub="trucks"
            tone={num(fleet.trucks) === 0 ? "warn" : "default"}
          />
          <Tile
            icon={<Timer className="h-4 w-4" />}
            label="Cron health"
            value={
              cronHealthy !== null && cronTotal !== null
                ? `${cronHealthy}/${cronTotal}`
                : "—"
            }
            sub={cronBad > 0 ? `${cronBad} unhealthy` : "all healthy"}
            tone={cronBad > 0 ? "bad" : "good"}
          />
        </div>

        {/* ── Blunt findings ────────────────────────────────────────────── */}
        {findings.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Findings — no sugarcoating
            </h3>
            <ul className="space-y-1.5">
              {findings.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs"
                >
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 shrink-0 mt-0.5 ${SEVERITY_STYLES[f.severity].pill}`}
                  >
                    {SEVERITY_STYLES[f.severity].label}
                  </Badge>
                  <span className="leading-relaxed">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              No bottlenecks or errors flagged in the latest report.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
