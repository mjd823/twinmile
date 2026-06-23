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

const CRON_JOB_DEFS: Record<string, { name: string; schedule: string; description: string; skill: string }> = {
  "00796b3c6135": { name: "Process Outreach Tasks", schedule: "*/15 * * * *", description: "Processes pending outreach tasks every 15 minutes", skill: "claude-code" },
  "93aaa6272b8c": { name: "Auto Onboarding Invitations", schedule: "0 8-20/2 * * *", description: "Sends onboarding invitations to qualified leads every 2 hours during business hours", skill: "claude-code" },
  "10177a8ab2cf": { name: "Outbound Prospecting (FMCSA)", schedule: "0 8 * * *", description: "Sofia queries FMCSA Census API daily at 8am for real owner-operators", skill: "web" },
  "8c53c6ce9d90": { name: "Daily AI Operations", schedule: "0 7 * * *", description: "Reviews overnight activity, processes pending onboarding tasks", skill: "web" },
  "17a94fde883f": { name: "Weekly Strategic Review", schedule: "0 6 * * 1", description: "Analyzes past week metrics, conversion rates, pipeline health", skill: "web" },
  "9ee75230bf31": { name: "Monthly Business Intelligence", schedule: "0 5 1 * *", description: "Aggregates monthly metrics for business intelligence report", skill: "web" },
  "e8dd1c631f6a": { name: "Driver Engagement", schedule: "0 9 * * *", description: "Checks for drivers needing engagement, sends follow-up messages", skill: "web" },
  "2395ac48f817": { name: "Auto Onboarding Invite", schedule: "0 8,10,12,14,16,18,20 * * 1-5", description: "Invites qualified prospects to onboarding portal on weekdays", skill: "claude-code" },
};

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

      // Merge static job definitions with live data
      const liveJobs = data.data?.cronJobs || [];
      const mergedJobs = Object.entries(CRON_JOB_DEFS).map(([id, def]) => {
        const live = liveJobs.find((j: any) => j.job_id === id || j.id === id);
        return {
          id,
          name: def.name,
          schedule: def.schedule,
          description: def.description,
          skill: def.skill,
          lastRun: live?.lastRun || live?.last_run_at || null,
          lastStatus: live?.lastStatus || live?.last_status || null,
          lastResult: live?.lastResult || null,
          nextRun: live?.nextRun || live?.next_run_at || null,
          todayCount: live?.todayCount || 0,
          enabled: live?.enabled ?? true,
          model: live?.model || "glm-5.2",
          provider: live?.provider || "ollama-cloud",
          promptPreview: live?.prompt_preview || "",
          workdir: live?.workdir,
        };
      });

      setCronJobs(mergedJobs);
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
                <Badge variant="secondary" className="text-[10px]">{log.action}</Badge>
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

              {/* Email Content Preview */}
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Email Content (Resend Template)</p>
                <div className="text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                  <div className="border-l-2 border-primary/40 pl-3 space-y-1">
                    <p><strong>Subject:</strong> Welcome to Twin Mile — Complete Your Onboarding (72h)</p>
                    <p><strong>From:</strong> Twin Mile &lt;alerts@contact.twinmile.com&gt;</p>
                    <p><strong>Body Preview:</strong></p>
                    <p className="italic">"Welcome to Twin Mile, {log.leadName}! You've been pre-qualified for our power-only program. Complete your onboarding in just a few steps using your personal link below. The link expires in 72 hours."</p>
                    <p className="text-[10px]">Includes: Operator details (name, company, equipment, experience, location) and a personalized onboarding button link.</p>
                  </div>
                </div>
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