"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
  UserCheck,
  History,
  HeartPulse,
  FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentHealth {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  reportsTo: string;
  status: "active" | "idle" | "error";
  lastActivity: string | null;
  lastActivityRelative: string;
  tasksToday: number;
  currentTask: string;
  nextScheduled: string;
  recentActivity: {
    id: string;
    action: string;
    description: string;
    success: boolean;
    timestamp: string | null;
  }[];
}

interface SupervisorReport {
  timestamp: string;
  agentsMonitored: number;
  activeAgents: number;
  idleAgents: number;
  errorsFound: number;
  recommendations: string[];
  idleAgentAssignments: Record<string, string>;
  tasksAssignedToday: number;
}

interface HistoryEntry {
  timestamp: string;
  agentsMonitored: number;
  activeAgents: number;
  idleAgents: number;
  errorsFound: number;
  recommendations: string[];
  idleAgentAssignments: Record<string, string>;
  keyFindings: string[];
}

interface DashboardData {
  success: boolean;
  latestReport: SupervisorReport;
  history: HistoryEntry[];
  agentHealth: AgentHealth[];
  serverTime: string;
}

// ── Color helpers ────────────────────────────────────────────────────────────

const COLOR_DOTS: Record<string, string> = {
  cyan: "bg-cyan-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const COLOR_TEXT: Record<string, string> = {
  cyan: "text-cyan-400",
  blue: "text-blue-400",
  purple: "text-purple-400",
  green: "text-green-400",
  orange: "text-orange-400",
  pink: "text-pink-400",
  amber: "text-amber-400",
  red: "text-red-400",
};

const COLOR_BG_SOFT: Record<string, string> = {
  cyan: "bg-cyan-500/10",
  blue: "bg-blue-500/10",
  purple: "bg-purple-500/10",
  green: "bg-green-500/10",
  orange: "bg-orange-500/10",
  pink: "bg-pink-500/10",
  amber: "bg-amber-500/10",
  red: "bg-red-500/10",
};

function colorDot(color: string): string {
  return COLOR_DOTS[color] || "bg-gray-500";
}
function colorText(color: string): string {
  return COLOR_TEXT[color] || "text-gray-400";
}
function colorBgSoft(color: string): string {
  return COLOR_BG_SOFT[color] || "bg-gray-500/10";
}

// ── Time formatting ──────────────────────────────────────────────────────────

function formatRelative(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateLong(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "active" | "idle" | "error" }) {
  if (status === "active") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
    );
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />;
}

function StatusBadge({ status }: { status: "active" | "idle" | "error" }) {
  if (status === "active") {
    return (
      <Badge className="border-transparent bg-green-500/15 text-green-400 gap-1.5">
        <StatusDot status="active" />
        Active
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="border-transparent bg-red-500/15 text-red-400 gap-1.5">
        <StatusDot status="error" />
        Error
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-amber-500/15 text-amber-400 gap-1.5">
      <StatusDot status="idle" />
      Idle
    </Badge>
  );
}

// ── Summary stat card ───────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-lg ${accent} flex items-center justify-center text-white flex-shrink-0`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase font-medium text-muted-foreground tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground">{sublabel}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab button (custom, matching timesheet style) ────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground bg-muted/30"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}

// ── Expanded agent row detail ────────────────────────────────────────────────

function AgentDetail({ agent }: { agent: AgentHealth }) {
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            Recent Activity
          </h4>
          {agent.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No recent activity on record.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {agent.recentActivity.map((a, i) => (
                <div
                  key={a.id || i}
                  className="flex items-center gap-3 p-2 rounded-md bg-background/40 border border-border/30"
                >
                  <div className="flex-shrink-0">
                    {a.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.action}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.description}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatRelative(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent info */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-blue-400" />
            Agent Details
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Department</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${colorBgSoft(agent.color)} ${colorText(agent.color)}`}
              >
                {agent.department}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Reports To</span>
              <span className="font-medium">{agent.reportsTo}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tasks Today</span>
              <span className="font-bold">{agent.tasksToday}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Current Focus</span>
              <span className="font-medium text-right max-w-[60%] truncate">
                {agent.currentTask}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Next Scheduled</span>
              <span className="font-medium text-right max-w-[60%]">
                {agent.nextScheduled}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expanded history row ─────────────────────────────────────────────────────

function HistoryDetail({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Key findings */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-blue-400" />
            Key Findings
          </h4>
          {entry.keyFindings.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No significant findings in this report.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {entry.keyFindings.map((finding, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs p-2 rounded-md bg-background/40 border border-border/30"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recommendations & assignments */}
        <div className="space-y-4">
          {entry.recommendations.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-amber-400" />
                Recommendations
              </h4>
              <ul className="space-y-1.5">
                {entry.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs p-2 rounded-md bg-background/40 border border-border/30"
                  >
                    <Shield className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(entry.idleAgentAssignments).length > 0 && (
            <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <UserCheck className="h-4 w-4 text-purple-400" />
                Assignments Made
              </h4>
              <div className="space-y-1.5">
                {Object.entries(entry.idleAgentAssignments).map(
                  ([name, task], i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/30"
                    >
                      <span className="h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {task}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function SupervisorDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = React.useState("latest");
  const [expandedAgent, setExpandedAgent] = React.useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = React.useState<number | null>(
    null,
  );
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/supervisor");
      if (!res.ok) {
        if (res.status === 401) {
          setError(
            "Authentication required. Please log in as admin.",
          );
          return;
        }
        throw new Error(`Failed to fetch (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch supervisor data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const report = data?.latestReport;
  const history = data?.history || [];
  const agentHealth = data?.agentHealth || [];

  // Compute summary counts
  const totalAgents = report?.agentsMonitored ?? agentHealth.length;
  const activeNow = report?.activeAgents ?? 0;
  const idleCount = report?.idleAgents ?? 0;
  const errorsFound = report?.errorsFound ?? 0;
  const tasksAssigned = report?.tasksAssignedToday ?? 0;

  // Agent status overview for Latest Report tab
  const agentStatusOverview = agentHealth;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            AI Supervisor Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Executive overview of agent performance and recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last updated:{" "}
            {lastRefresh.toLocaleTimeString("en-US", { timeZone: "America/Chicago" })} CT
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Agents"
          value={totalAgents}
          sublabel="on roster"
          accent="bg-blue-500"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Active Now"
          value={activeNow}
          sublabel="currently working"
          accent="bg-green-500"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Need Attention"
          value={idleCount}
          sublabel="idle agents"
          accent="bg-amber-500"
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Errors Found"
          value={errorsFound}
          sublabel="issues flagged"
          accent="bg-red-500"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tasks Assigned"
          value={tasksAssigned}
          sublabel="proactive assignments"
          accent="bg-purple-500"
        />
      </div>

      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-1 border-b border-border/60 -mx-1 px-1 mb-0">
            <TabButton
              active={activeTab === "latest"}
              onClick={() => setActiveTab("latest")}
              icon={<FileText className="h-4 w-4" />}
            >
              Latest Report
            </TabButton>
            <TabButton
              active={activeTab === "health"}
              onClick={() => setActiveTab("health")}
              icon={<HeartPulse className="h-4 w-4" />}
              count={agentHealth.length}
            >
              Agent Health
            </TabButton>
            <TabButton
              active={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              icon={<History className="h-4 w-4" />}
              count={history.length}
            >
              History
            </TabButton>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* ── Loading state ─────────────────────────────────────────── */}
          {loading && !data && (
            <div className="py-16 flex flex-col items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Loading supervisor dashboard…
              </p>
            </div>
          )}

          {/* ── Tab 1: Latest Report ──────────────────────────────────── */}
          {activeTab === "latest" && report && (
            <div className="space-y-5 mt-4">
              {/* Report timestamp */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Report generated:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateLong(report.timestamp)}
                  </span>
                </span>
              </div>

              {/* Agent Status Overview */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-400" />
                  Agent Status Overview
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {agentStatusOverview.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-border/40 bg-muted/10 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`h-8 w-8 rounded-full ${colorDot(agent.color)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                        >
                          {agent.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {agent.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {agent.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={agent.status} />
                        <span className="text-[10px] text-muted-foreground">
                          {agent.lastActivityRelative}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {agent.tasksToday} tasks today
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Idle Agents & Assignments */}
              {Object.keys(report.idleAgentAssignments).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <UserCheck className="h-4 w-4 text-purple-400" />
                    Idle Agents &amp; Assignments
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(report.idleAgentAssignments).map(
                      ([name, task], i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/10"
                        >
                          <span className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {name.charAt(0)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">
                              {name}
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                — was idle, assigned:
                              </span>
                            </p>
                            <p className="text-xs text-foreground mt-0.5">
                              {task}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/10"
                      >
                        <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-amber-400">
                            {i + 1}
                          </span>
                        </div>
                        <p className="text-xs">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors Found */}
              {report.errorsFound > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    Errors Found ({report.errorsFound})
                  </h3>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                    <p className="text-sm text-red-400">
                      {report.errorsFound} error(s) were flagged during the
                      latest supervisor check. Review agent logs for details.
                    </p>
                  </div>
                </div>
              )}

              {report.errorsFound === 0 && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                  <p className="text-sm text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    No errors detected. All systems operating normally.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2: Agent Health ───────────────────────────────────── */}
          {activeTab === "health" && (
            <div className="mt-4">
              <div className="overflow-x-auto -mx-1 px-1">
                {loading && agentHealth.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Loading agent health…
                    </p>
                  </div>
                ) : agentHealth.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <HeartPulse className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No agent data available.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left">
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Agent
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Department
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Status
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Last Activity
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap text-center">
                          Tasks
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Current Task
                        </th>
                        <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">
                          Next Scheduled
                        </th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentHealth.map((agent, idx) => {
                        const isExpanded = expandedAgent === agent.id;
                        return (
                          <React.Fragment key={agent.id}>
                            <tr
                              onClick={() =>
                                setExpandedAgent(
                                  isExpanded ? null : agent.id,
                                )
                              }
                              className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/30 ${
                                idx % 2 === 1 ? "bg-muted/10" : ""
                              } ${isExpanded ? "bg-muted/30" : ""}`}
                            >
                              {/* Agent */}
                              <td className="py-2.5 px-2">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`h-8 w-8 rounded-full ${colorDot(agent.color)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                                  >
                                    {agent.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">
                                      {agent.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {agent.role}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {/* Department */}
                              <td className="py-2.5 px-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${colorBgSoft(agent.color)} ${colorText(agent.color)}`}
                                >
                                  {agent.department}
                                </span>
                              </td>
                              {/* Status */}
                              <td className="py-2.5 px-2">
                                <StatusBadge status={agent.status} />
                              </td>
                              {/* Last Activity */}
                              <td className="py-2.5 px-2 whitespace-nowrap text-xs text-muted-foreground">
                                {agent.lastActivityRelative}
                              </td>
                              {/* Tasks */}
                              <td className="py-2.5 px-2 text-center font-bold">
                                {agent.tasksToday}
                              </td>
                              {/* Current Task */}
                              <td className="py-2.5 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                                {agent.currentTask}
                              </td>
                              {/* Next Scheduled */}
                              <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                                {agent.nextScheduled}
                              </td>
                              {/* Expand */}
                              <td className="py-2.5 px-2 text-muted-foreground">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-muted/10">
                                <td colSpan={8} className="p-0">
                                  <AgentDetail agent={agent} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Tab 3: History ────────────────────────────────────────── */}
          {activeTab === "history" && (
            <div className="mt-4">
              {history.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No supervisor reports found in the last 30 days.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, idx) => {
                    const isExpanded = expandedHistory === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-border/40 overflow-hidden"
                      >
                        <div
                          onClick={() =>
                            setExpandedHistory(
                              isExpanded ? null : idx,
                            )
                          }
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-muted/20 ${
                            isExpanded ? "bg-muted/20" : ""
                          }`}
                        >
                          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">
                                {formatTimestamp(entry.timestamp)}
                              </p>
                              <Badge
                                variant="outline"
                                className="text-[10px] border-border/60"
                              >
                                {entry.agentsMonitored} agents
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                {entry.activeAgents} active
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {entry.idleAgents} idle
                              </span>
                              {entry.errorsFound > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                  {entry.errorsFound} errors
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/40">
                            <HistoryDetail entry={entry} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <p className="text-[11px] text-muted-foreground text-center">
        Supervisor dashboard auto-refreshes every 30 seconds. Data sourced
        from AI Supervisor monitoring runs.
      </p>
    </div>
  );
}
