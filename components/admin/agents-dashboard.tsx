"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Crown,
  Truck,
  UserCheck,
  Megaphone,
  DollarSign,
  Heart,
  Cpu,
  Wrench,
  Gauge,
  Settings,
  PlayCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowStep {
  step: number;
  label: string;
  description: string;
  leadTypes: ("quote" | "driver")[];
  tools?: string[];
}

interface AgentTool {
  id: string;
  name: string;
  description: string;
  agentUsage: string;
}

interface AgentActivity {
  id: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  success: boolean;
  timestamp: string | null;
}

interface AgentMetrics {
  tasksToday: number;
  tasksThisWeek: number;
  tasksThisMonth: number;
  totalTasks: number;
  successRate: number;
  lastActivityTime: string | null;
}

interface AgentConfig {
  model: string;
  provider: string;
  department: string;
  reportsTo: string;
}

interface AgentAction {
  action: string;
  label: string;
  description: string;
  icon: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  icon: string;
  reportsTo?: string;
  status: "active" | "idle" | "busy";
  currentTask: string;
  tasksToday: number;
  lastActivityTime: string | null;
  nextScheduled: string;
  action: AgentAction | null;
  workflow: WorkflowStep[];
  tools: AgentTool[];
  metrics: AgentMetrics;
  recentActivity: AgentActivity[];
  configuration: AgentConfig;
}

interface DashboardSummary {
  totalAgents: number;
  totalTasksToday: number;
  activeCount: number;
  idleCount: number;
  busyCount: number;
  totalActivityRecords: number;
}

// ── Icon mapping ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  Users,
  Crown,
  Truck,
  UserCheck,
  Megaphone,
  DollarSign,
  Heart,
};

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function AgentsDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [expandedAgent, setExpandedAgent] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "active" | "idle">("all");
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/agents");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Authentication required. Please log in as admin.");
          return;
        }
        throw new Error(`Failed to fetch (${res.status})`);
      }
      const data = await res.json();
      setAgents(data.data?.agents || []);
      setSummary(data.data?.summary || null);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch agent data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredAgents = React.useMemo(() => {
    if (filter === "all") return agents;
    if (filter === "active") return agents.filter((a) => a.status === "active" || a.status === "busy");
    return agents.filter((a) => a.status === "idle");
  }, [agents, filter]);

  const activeCount = agents.filter((a) => a.status === "active" || a.status === "busy").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const busyCount = agents.filter((a) => a.status === "busy").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            AI Agent Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time view of all 8 AI agents working across the Twin Mile pipeline
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

      {/* Error banner */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Active Agents"
          value={activeCount}
          sublabel={`${agents.length} total`}
          color="green"
        />
        <SummaryCard
          icon={<Zap className="h-5 w-5" />}
          label="Tasks Today"
          value={summary?.totalTasksToday ?? 0}
          sublabel="across all agents"
          color="blue"
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          label="Activity Records"
          value={summary?.totalActivityRecords ?? 0}
          sublabel="in database"
          color="purple"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5" />}
          label="Idle Agents"
          value={idleCount}
          sublabel={busyCount > 0 ? `${busyCount} busy` : "none busy"}
          color="amber"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")} icon={<Users className="h-4 w-4" />}>
          All ({agents.length})
        </FilterTab>
        <FilterTab active={filter === "active"} onClick={() => setFilter("active")} icon={<Zap className="h-4 w-4" />}>
          Active ({activeCount})
        </FilterTab>
        <FilterTab active={filter === "idle"} onClick={() => setFilter("idle")} icon={<Clock className="h-4 w-4" />}>
          Idle ({idleCount})
        </FilterTab>
      </div>

      {/* Agent Grid */}
      {filteredAgents.length === 0 && !loading ? (
        <Card className="border-border/60">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="text-muted-foreground/40 mb-3">
              <Users className="h-12 w-12" />
            </div>
            <p className="text-sm text-muted-foreground">
              No agents match this filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              expanded={expandedAgent === agent.id}
              onToggle={() =>
                setExpandedAgent(expandedAgent === agent.id ? null : agent.id)
              }
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        Auto-refreshing every 30 seconds ·{" "}
        {summary?.totalTasksToday ?? 0} tasks completed today across all agents
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: "border-green-500/30 bg-green-500/5 text-green-600",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-600",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-600",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-600",
  };
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function AgentCard({
  agent,
  expanded,
  onToggle,
}: {
  agent: Agent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const AgentIcon = ICON_MAP[agent.icon] || Users;
  const statusConfig = {
    active: { color: "green", icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, label: "Active", bg: "bg-green-500/10 border-green-500/30" },
    busy: { color: "blue", icon: <Zap className="h-4 w-4 text-blue-500 animate-pulse" />, label: "Busy", bg: "bg-blue-500/10 border-blue-500/30" },
    idle: { color: "gray", icon: <Clock className="h-4 w-4 text-muted-foreground" />, label: "Idle", bg: "bg-muted/30 border-border/60" },
  };
  const cfg = statusConfig[agent.status];

  const formatTime = (ts: string | null) => {
    if (!ts) return "Never";
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  return (
    <Card className={`${cfg.bg} border transition-all`}>
      {/* Card header — clickable */}
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Agent avatar */}
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${agent.color} flex-shrink-0`}>
              <AgentIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
                <Badge
                  variant={agent.status === "idle" ? "secondary" : "default"}
                  className="text-[10px] flex items-center gap-1"
                >
                  {cfg.icon}
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {agent.role} · {agent.department}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {agent.currentTask}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Tasks Today</p>
              <p className="text-xl font-bold">{agent.tasksToday}</p>
            </div>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/60 p-4 space-y-5 bg-background/40">
          {/* Quick metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniMetric icon={<TrendingUp className="h-4 w-4" />} label="This Week" value={agent.metrics.tasksThisWeek} />
            <MiniMetric icon={<Activity className="h-4 w-4" />} label="This Month" value={agent.metrics.tasksThisMonth} />
            <MiniMetric icon={<Gauge className="h-4 w-4" />} label="Success Rate" value={`${agent.metrics.successRate}%`} />
            <MiniMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Total" value={agent.metrics.totalTasks} />
          </div>

          {/* Current action */}
          {agent.action && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <PlayCircle className="h-3 w-3" />
                Primary Action
              </h4>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{agent.action.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{agent.action.description}</p>
              </div>
            </div>
          )}

          {/* Workflow steps */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Workflow ({agent.workflow.length} steps)
            </h4>
            <div className="space-y-1.5">
              {agent.workflow.map((step) => (
                <div
                  key={step.step}
                  className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/10 p-2.5"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    {step.tools && step.tools.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {step.tools.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[9px] flex items-center gap-1">
                            <Wrench className="h-2.5 w-2.5" />
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tools used */}
          {agent.tools.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                Tools Used
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {agent.tools.map((tool) => (
                  <div key={tool.id} className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">{tool.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                    {tool.agentUsage && (
                      <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
                        {tool.agentUsage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity from agent_activity collection */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Recent Activity ({agent.recentActivity.length})
            </h4>
            {agent.recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No activity logged in agent_activity collection yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {agent.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-2 p-2 rounded-lg border border-border/40 bg-muted/10"
                  >
                    <div className={`mt-0.5 ${act.success ? "text-green-500" : "text-red-500"}`}>
                      {act.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[9px]">{act.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                      {act.timestamp && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatTime(act.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Configuration
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <ConfigItem label="Model" value={agent.configuration.model} icon={<Cpu className="h-3.5 w-3.5" />} />
              <ConfigItem label="Provider" value={agent.configuration.provider} icon={<Zap className="h-3.5 w-3.5" />} />
              <ConfigItem label="Department" value={agent.configuration.department} icon={<Users className="h-3.5 w-3.5" />} />
              <ConfigItem label="Reports To" value={agent.configuration.reportsTo} icon={<Crown className="h-3.5 w-3.5" />} />
            </div>
          </div>

          {/* Last / next timing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Last Activity</p>
              <p className="text-sm font-medium">{formatTime(agent.lastActivityTime)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Next Scheduled</p>
              <p className="text-sm font-medium">{agent.nextScheduled}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function ConfigItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase font-medium">{label}</span>
      </div>
      <p className="text-sm font-medium mt-1 capitalize">{value}</p>
    </div>
  );
}