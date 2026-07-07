import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2 } from "lucide-react";
import type { JobStatusReport, JobStatus } from "@/lib/agent-status";

/**
 * "Agent Timesheet" — who's clocked in, per registered Vercel cron job.
 * Server-rendered from lib/agent-status.ts (the exact computation the
 * CRON_SECRET-gated /api/admin/agent-status route serves to the hub), so the
 * admin UI never needs the cron secret.
 */

const STATUS_META: Record<
  JobStatus,
  { label: string; dot: string; pill: string }
> = {
  on_time: {
    label: "On time",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  late: {
    label: "Late",
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  error: {
    label: "Error",
    dot: "bg-red-500",
    pill: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  never_ran: {
    label: "Never ran",
    dot: "bg-zinc-500",
    pill: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
};

const CADENCE_LABEL: Record<string, string> = {
  "sub-daily": "Multiple / day",
  daily: "Daily",
  weekly: "Mondays",
};

function chicagoTime(iso: string | null): string {
  if (!iso) return "—";
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT"
  );
}

function relative(hours: number | null): string {
  if (hours === null) return "";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SupervisorTimesheet({ report }: { report: JobStatusReport | null }) {
  if (!report) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-primary" />
            Agent Timesheet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Timesheet unavailable — database not reachable.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { jobs, summary } = report;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-primary" />
            Agent Timesheet
            {summary.allClockedIn && (
              <Badge className="border-transparent bg-emerald-500/15 text-emerald-400 gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                All clocked in
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {summary.onTime} on time
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {summary.late} late
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {summary.error} error
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              {summary.neverRan} never ran
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Refreshed{" "}
          {new Date(report.generatedAt).toLocaleTimeString("en-US", {
            timeZone: "America/Chicago",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          CT · it&apos;s {report.chicagoWeekday} in Chicago — weekly agents work
          Mondays only.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="border-b border-border/60 text-left">
                <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                  Agent / Job
                </th>
                <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                  Cadence
                </th>
                <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                  Last clock-in
                </th>
                <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => {
                const meta = STATUS_META[job.status];
                return (
                  <tr
                    key={job.id}
                    className={`border-b border-border/40 ${idx % 2 === 1 ? "bg-muted/10" : ""}`}
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate text-xs sm:text-sm">
                            {job.agent}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {job.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <p className="text-xs">{CADENCE_LABEL[job.cadence] ?? job.cadence}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {job.schedule.split(" (")[0]} UTC
                      </p>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap tabular-nums">
                      <p className="text-xs">{chicagoTime(job.lastRun)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {relative(job.hoursSinceLastRun)}
                      </p>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${meta.pill}`}
                      >
                        {meta.label}
                      </Badge>
                      {job.status === "late" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          expected every {job.expectedEveryHours}h
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
