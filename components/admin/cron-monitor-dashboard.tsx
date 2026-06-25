"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw,
  ChevronDown, ChevronRight, Activity, Mail, Zap,
  Calendar, Server, Cpu, PlayCircle, PauseCircle,
} from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
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
  expiresAt: string;
  completedAt: string | null;
  aiScore: number;
  sessionToken: string;
}

export function CronMonitorDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cronJobs, setCronJobs] = React.useState<CronJob[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([]);
  const [emailLogs, setEmailLogs] = React.useState<EmailLog[]>([]);
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
            Last updated: {lastRefresh.toLocaleTimeString("en-US")}
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
          label="Emails Sent"
          value={emailLogs.length}
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

function StatusCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
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
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className={`${cfg.bg} border transition-all`}>
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {cfg.icon}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{job.name}</h3>
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
                  {actionLabels[log.action] || log.action}
                </Badge>
              </div>
              {log.result && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {log.result.carriersFound !== undefined && (
                    <span className="mr-3">📊 Found: {log.result.carriersFound}</span>
                  )}
                  {log.result.qualified !== undefined && (
                    <span className="mr-3">✅ Qualified: {log.result.qualified}</span>
                  )}
                  {log.result.saved !== undefined && (
                    <span className="mr-3">💾 Saved: {log.result.saved}</span>
                  )}
                  {log.result.prospectsFound !== undefined && (
                    <span className="mr-3">📊 Prospects: {log.result.prospectsFound}</span>
                  )}
                  {log.result.prospectsSaved !== undefined && (
                    <span className="mr-3">💾 Saved: {log.result.prospectsSaved}</span>
                  )}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(log.timestamp).toLocaleString("en-US")}
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
      {logs.map((log) => (
        <Card key={log.id} className="border-border/60 hover:border-border transition-colors">
          <button
            onClick={() => setExpandedEmail(expandedEmail === log.id ? null : log.id)}
            className="w-full text-left p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  <Mail className={`h-5 w-5 ${log.status === "completed" ? "text-green-500" : log.status === "pending" ? "text-amber-500" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{log.leadName}</span>
                    {log.aiScore && (
                      <Badge variant="secondary" className="text-[10px]">Score: {log.aiScore}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize">{log.leadType?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    To: {log.recipient || "No email on file — NOT SENT"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Sent: {new Date(log.sentAt).toLocaleString("en-US")}</span>
                    {log.completedAt && (
                      <span className="text-green-600">✓ Completed: {new Date(log.completedAt).toLocaleString("en-US")}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={log.status === "completed" ? "default" : log.status === "pending" ? "secondary" : "destructive"} className="text-[10px] capitalize">
                  {log.status}
                </Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedEmail === log.id ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {expandedEmail === log.id && (
            <div className="border-t border-border/60 p-3 bg-muted/10 space-y-3">
              {/* Email Status */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Delivery Status</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Recipient:</span>{" "}
                    <span className="font-medium">{log.recipient || "No email — session created but email not sent"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Session Token:</span>{" "}
                    <code className="text-[10px] bg-muted/40 px-1 rounded">{log.sessionToken}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent:</span>{" "}
                    <span className="font-medium">{new Date(log.sentAt).toLocaleString("en-US")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires:</span>{" "}
                    <span className="font-medium">{new Date(log.expiresAt).toLocaleString("en-US")}</span>
                  </div>
                </div>
              </div>

              {/* Email Content Preview — actual rendered HTML */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Email Preview (as received)</p>
                <div className="rounded-lg overflow-hidden border border-border/60 bg-white">
                  <iframe
                    srcDoc={generateEmailHTML(log.leadName, log.sessionToken)}
                    className="w-full h-[400px] border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  This is exactly what the prospect receives via Resend. Logo, branding, and onboarding button included.
                </p>
              </div>

              {/* Onboarding Link */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Onboarding Portal Link</p>
                <code className="text-[10px] text-primary break-all">
                  https://twinmile.com/onboarding?token={log.sessionToken}...
                </code>
                <p className="text-[10px] text-muted-foreground mt-1">
                  This link was included in the email. The prospect clicks it to start the 7-step onboarding.
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

// Generate the actual email HTML that Resend sends to prospects
function generateEmailHTML(leadName: string, token: string): string {
  const onboardingUrl = `https://twinmile.com/onboarding?token=${token}`;
  const appName = process.env.NEXT_PUBLIC_APP_URL || "https://twinmile.com";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Twin Mile — Complete Your Onboarding</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ec;">
            <tr>
              <td style="background:#111827;padding:20px 24px;">
                <img src="${appName}/logo.png" alt="Twin Mile LLC" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#111827;">
                <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#475569;font-weight:700;margin:0 0 10px;">Onboarding Invitation</p>
                <h1 style="margin:0 0 10px;font-size:36px;line-height:1.2;color:#111827;">Welcome to Twin Mile, ${leadName}!</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#334155;">You've been pre-qualified for our power-only program. Complete your onboarding in just a few steps using your personal link below.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:22px;">
                  <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">Name</td><td style="padding:6px 0;font-size:14px;color:#374151;">${leadName}</td></tr>
                </table>
                <p style="margin:14px 0 8px;font-size:14px;color:#4b5563;"><strong>Your personal onboarding link (expires in 72 hours):</strong></p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:8px;margin-bottom:22px;">
                  <tr>
                    <td style="border-radius:11px;background:#0f766e;">
                      <a href="${onboardingUrl}" style="display:inline-block;padding:13px 20px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Complete Onboarding</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link:<br/><a href="${onboardingUrl}" style="color:#0f766e;word-break:break-all;">${onboardingUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#475569;">
                  Twin Mile LLC • Houston, TX<br/>
                  <a href="tel:+12817107787" style="color:#0f766e;text-decoration:none;">(281) 710-7787</a> •
                  <a href="mailto:admin@twinmile.com" style="color:#0f766e;text-decoration:none;">admin@twinmile.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}