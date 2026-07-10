"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailPreviewFrame } from "@/components/admin/EmailPreviewFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw,
  ChevronDown, ChevronRight, Activity, Mail, Zap,
  Calendar, Server, Cpu, PlayCircle, PauseCircle,
} from "lucide-react";

interface CronAgent {
  name: string;
  role: string;
  avatar: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  description?: string;
  agent?: CronAgent;
  lastRun: string | null;
  lastStatus: string | null;
  lastResult?: any;
  nextRun: string | null;
  enabled: boolean;
  model: string | null;
  provider: string | null;
  todayCount?: number;
  promptPreview?: string;
  skill?: string;
  workdir?: string;
}

interface ActivityLog {
  id: string;
  action: string;
  agent: string;
  agentRole: string;
  agentDepartment: string;
  result: any;
  success: boolean;
  timestamp: string;
}

interface EmailLog {
  id: string;
  type: string;
  recipient: string;
  leadName: string;
  leadType: string;
  status: string;
  sentAt: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

interface EmailStats {
  sentLast24h: number;
  sentTotal: number;
  pending: number;
  failed: number;
}

/** Format any timestamp in America/Chicago — the business clock. */
function fmtCT(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CronMonitorDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cronJobs, setCronJobs] = React.useState<CronJob[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([]);
  const [emailLogs, setEmailLogs] = React.useState<EmailLog[]>([]);
  const [emailStats, setEmailStats] = React.useState<EmailStats | null>(null);
  const [expandedJob, setExpandedJob] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"jobs" | "activity" | "emails">("jobs");
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/cron-monitor");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // Use live data from API (includes all 14 jobs from Hermes)
      const liveJobs: CronJob[] = (data.data?.cronJobs || []).map((j: any) => ({
        id: j.id,
        name: j.name,
        schedule: j.schedule,
        description: j.description || "",
        agent: j.agent || { name: "System", role: "Automation", avatar: "⚙️" },
        skill: j.skill || "web",
        lastRun: j.lastRun || j.last_run_at || null,
        lastStatus: j.lastStatus || j.last_status || null,
        lastResult: j.lastResult || null,
        nextRun: j.nextRun || j.next_run_at || null,
        todayCount: j.todayCount || 0,
        enabled: j.enabled ?? true,
        model: j.model || "openrouter/owl-alpha",
        provider: j.provider || "openrouter",
        promptPreview: j.prompt_preview || "",
        workdir: j.workdir,
      }));

      setCronJobs(liveJobs);
      setActivityLogs(data.data?.activityLogs || []);
      setEmailLogs(data.data?.emailLogs || []);
      setEmailStats(data.data?.emailStats || null);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const okCount = cronJobs.filter(j => j.lastStatus === "ok").length;
  const errorCount = cronJobs.filter(j => j.lastStatus === "error").length;
  const pendingCount = cronJobs.filter(j => !j.lastStatus).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Automation Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of all cron jobs, pipeline activity, and email communications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} CT
          </span>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Healthy Jobs"
          value={okCount}
          color="green"
        />
        <StatusCard
          icon={<XCircle className="h-5 w-5" />}
          label="Erroring Jobs"
          value={errorCount}
          color="red"
        />
        <StatusCard
          icon={<Clock className="h-5 w-5" />}
          label="Not Run Yet"
          value={pendingCount}
          color="amber"
        />
        <StatusCard
          icon={<Mail className="h-5 w-5" />}
          label="Emails Sent (24h)"
          value={emailStats?.sentLast24h ?? 0}
          sublabel={emailStats ? `${emailStats.sentTotal.toLocaleString()} all-time · ${emailStats.pending} queued · ${emailStats.failed} failed` : undefined}
          color="blue"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border/60">
        <TabButton active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} icon={<Server className="h-4 w-4" />}>
          Cron Jobs ({cronJobs.length})
        </TabButton>
        <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")} icon={<Zap className="h-4 w-4" />}>
          Activity Feed ({activityLogs.length})
        </TabButton>
        <TabButton active={activeTab === "emails"} onClick={() => setActiveTab("emails")} icon={<Mail className="h-4 w-4" />}>
          Email Log ({emailLogs.length})
        </TabButton>
      </div>

      {/* Content */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {activeTab === "jobs" && (
        <div className="space-y-3">
          {cronJobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
            />
          ))}
        </div>
      )}

      {activeTab === "activity" && (
        <ActivityFeed logs={activityLogs} />
      )}

      {activeTab === "emails" && (
        <EmailLogView logs={emailLogs} />
      )}
    </div>
  );
}

function StatusCard({ icon, label, value, color, sublabel }: { icon: React.ReactNode; label: string; value: number; color: string; sublabel?: string }) {
  const colors: Record<string, string> = {
    green: "border-green-500/30 bg-green-500/5 text-green-600",
    red: "border-red-500/30 bg-red-500/5 text-red-600",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-600",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-600",
  };
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sublabel}</p>}
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function CronJobCard({ job, expanded, onToggle }: { job: any; expanded: boolean; onToggle: () => void }) {
  const status = job.lastStatus;
  const statusConfig = {
    ok: { color: "green", icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, label: "Success", bg: "bg-green-500/10 border-green-500/30" },
    error: { color: "red", icon: <XCircle className="h-5 w-5 text-red-500" />, label: "Error", bg: "bg-red-500/10 border-red-500/30" },
    null: { color: "gray", icon: <Clock className="h-5 w-5 text-muted-foreground" />, label: "Pending", bg: "bg-muted/30 border-border/60" },
  };
  const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.null;

  const formatDate = fmtCT;

  return (
    <Card className={`${cfg.bg} border transition-all`}>
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {job.agent && (
              <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center text-lg flex-shrink-0 border border-border/60">
                {job.agent.avatar}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{job.name}</h3>
                {job.agent && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {job.agent.name} · {job.agent.role}
                  </Badge>
                )}
                <Badge variant={status === "ok" ? "default" : status === "error" ? "destructive" : "secondary"} className="text-[10px]">
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase">Last Run</p>
              <p className="text-xs font-medium">{formatDate(job.lastRun)}</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-muted-foreground uppercase">Next Run</p>
              <p className="text-xs font-medium">{formatDate(job.nextRun)}</p>
            </div>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-4 space-y-4 bg-background/40">
          {/* Job Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Schedule</h4>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <code className="text-sm bg-muted/40 px-2 py-1 rounded">{job.schedule}</code>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Model</h4>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{job.model}</span>
                <Badge variant="outline" className="text-[10px]">{job.provider}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Skill</h4>
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium capitalize">{job.skill}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Status</h4>
              <div className="flex items-center gap-2">
                {job.enabled ? <PlayCircle className="h-4 w-4 text-green-500" /> : <PauseCircle className="h-4 w-4 text-amber-500" />}
                <span className="text-sm font-medium">{job.enabled ? "Active" : "Paused"}</span>
              </div>
            </div>
          </div>

          {/* What This Job Does */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">What This Job Does</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
          </div>

          {/* Prompt Preview */}
          {job.promptPreview && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Task Instructions</h4>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                {job.promptPreview}
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Last Run</p>
              <p className="text-sm font-medium">{formatDate(job.lastRun)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Next Scheduled</p>
              <p className="text-sm font-medium">{formatDate(job.nextRun)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Runs Today</p>
              <p className="text-sm font-bold text-primary">{job.todayCount || 0}</p>
            </div>
          </div>

          {/* Last Run Results */}
          {job.lastResult && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Last Run Results</h4>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                {Object.entries(job.lastResult).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Turn a heterogeneous result payload into one readable sentence. */
function summarizeResult(result: any): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result !== "object") return String(result);
  if (result.summary) return String(result.summary);
  if (result.carriersFound !== undefined)
    return `Found ${result.carriersFound} carriers · ${result.qualified || 0} qualified · ${result.saved || 0} saved`;
  if (result.sent !== undefined)
    return `${result.sent} emails sent · ${result.failed || 0} failed · ${result.skipped || 0} skipped`;
  if (result.prospectsFound !== undefined)
    return `Found ${result.prospectsFound} prospects · ${result.prospectsSaved || 0} saved`;
  if (result.agentsMonitored !== undefined)
    return `Monitored ${result.agentsMonitored} agents · ${result.errorsFound || 0} errors found`;
  if (result.tasksProcessed !== undefined)
    return `${result.tasksProcessed} outreach tasks processed`;
  const entries = Object.entries(result)
    .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
    .slice(0, 3);
  return entries.map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(v)}`).join(" · ");
}

function ActivityFeed({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <EmptyState icon={<Zap className="h-12 w-12" />} message="No activity recorded yet" />;
  }

  const actionLabels: Record<string, string> = {
    "outreach_processing": "Processing Outreach",
    "outreach_cron": "Outreach Processed",
    "fmcsa_prospecting": "FMCSA Search",
    "outbound_prospecting": "Prospecting Run",
    "web_prospecting": "Web Search",
    "browser_prospecting": "Browser Research",
    "onboarding_invite": "Onboarding Invite",
    "auto_onboarding_invite": "Onboarding Invite",
    "daily_ai_ops": "Daily Ops Review",
    "daily_sales_review": "Sales Review",
    "daily_ops_check": "Ops Check",
    "hr_onboarding_review": "HR Review",
    "daily_finance_review": "Finance Review",
    "customer_success_check": "Customer Success",
    "driver_engagement": "Driver Engagement",
    "marketing_analysis": "Marketing Analysis",
    "ceo_strategic_review": "CEO Review",
    "supervisor_monitoring": "Supervisor Check",
    "monthly_bi": "Monthly BI",
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="border-border/60 hover:border-border transition-colors">
          <CardContent className="p-3 flex items-start gap-3">
            <div className={`mt-0.5 ${log.success ? "text-green-500" : "text-red-500"}`}>
              {log.success ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{log.agent}</span>
                <Badge variant="outline" className="text-[10px]">{log.agentRole}</Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {actionLabels[log.action] || String(log.action).replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summarizeResult(log.result) || (log.success ? "Completed" : "Failed")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {fmtCT(log.timestamp)} CT
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmailLogView({ logs }: { logs: EmailLog[] }) {
  const [expandedEmail, setExpandedEmail] = React.useState<string | null>(null);

  if (logs.length === 0) {
    return <EmptyState icon={<Mail className="h-12 w-12" />} message="No emails sent yet" />;
  }

  return (
    <div className="space-y-2">
      {/* Automation shows the last N sends for cron health; deep email
          browsing (all pages, real totals, replies) lives in ONE place. */}
      <p className="text-xs text-muted-foreground">
        Latest {logs.length} sends —{" "}
        <a href="/admin/outreach" className="text-primary hover:underline">
          see all in Emails
        </a>
        .
      </p>
      {logs.map((log) => (
        <Card key={log.id} className="border-border/60 hover:border-border transition-colors">
          <button
            onClick={() => setExpandedEmail(expandedEmail === log.id ? null : log.id)}
            className="w-full text-left p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  <Mail className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{log.leadName}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{log.type?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {log.subject || "(subject unavailable)"} — to {log.recipient || "unknown"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Sent {fmtCT(log.sentAt)} CT
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="default" className="text-[10px] capitalize">{log.status}</Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedEmail === log.id ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedEmail === log.id && (
            <div className="border-t border-border/60 p-3 bg-muted/10 space-y-3">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Email as delivered
                </p>
                {log.bodyHtml ? (
                  <EmailPreviewFrame html={log.bodyHtml} title="Email Preview" />
                ) : log.bodyText ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs text-muted-foreground max-h-[380px] overflow-y-auto">
                    {log.bodyText}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sent before email copies were stored — see the Outreach tab for a re-rendered version.
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Exact copy persisted at send time — this is what the recipient saw.
                </p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-12 flex flex-col items-center justify-center text-center">
        <div className="text-muted-foreground/40 mb-3">{icon}</div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

