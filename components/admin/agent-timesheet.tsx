"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Calendar,
  RefreshCw,
  Zap,
  Activity,
  Target,
  Briefcase,
  Coffee,
  XCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskEntry {
  id: string;
  action: string;
  description: string;
  result: any;
  success: boolean;
  timestamp: string | null;
}

interface WeeklySchedule {
  days: string;
  shiftStart: string;
  shiftEnd: string;
  hoursPerDay: number;
  taskLabel: string;
}

interface Performance {
  successRate: number;
  avgTasksPerDay: number;
  totalTasks: number;
  trend: "up" | "down" | "steady";
}

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  reportsTo: string | null;
  status: "on_clock" | "off_duty" | "on_break";
  onClock: boolean;
  shiftStart: string;
  shiftEnd: string;
  shiftStart24: string;
  shiftEnd24: string;
  hoursToday: number;
  hoursThisWeek: number;
  tasksToday: number;
  tasksThisWeek: number;
  expectedTasksPerDay: number;
  productivityScore: number;
  successRate: number;
  lastActivityTime: string | null;
  taskLabel: string;
  todaysTasks: TaskEntry[];
  recentActivity: TaskEntry[];
  weeklySchedule: WeeklySchedule;
  performance: Performance;
}

interface Summary {
  totalEmployees: number;
  currentlyOnClock: number;
  totalTasksToday: number;
  avgProductivity: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  serverTime: string;
}

type FilterTab = "all" | "on_clock" | "off_duty" | "by_department";

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

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Employee["status"] }) {
  if (status === "on_clock") {
    return (
      <Badge className="border-transparent bg-green-500/15 text-green-400 gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        On Clock
      </Badge>
    );
  }
  if (status === "on_break") {
    return (
      <Badge className="border-transparent bg-amber-500/15 text-amber-400 gap-1.5">
        <Coffee className="h-3 w-3" />
        On Break
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1.5 border-border/60">
      <span className="h-2 w-2 rounded-full bg-gray-500" />
      Off Duty
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
        <div className={`h-10 w-10 rounded-lg ${accent} flex items-center justify-center text-white flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase font-medium text-muted-foreground tracking-wide">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Filter tab button ───────────────────────────────────────────────────────

function FilterButton({
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

// ── Productivity score display ──────────────────────────────────────────────

function ProductivityBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-green-400 bg-green-500/10" :
    score >= 40 ? "text-amber-400 bg-amber-500/10" :
    "text-muted-foreground bg-muted/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score >= 75 ? <TrendingUp className="h-3 w-3" /> :
       score >= 40 ? <Minus className="h-3 w-3" /> :
       <TrendingDown className="h-3 w-3" />}
      {score}%
    </span>
  );
}

function TrendIcon({ trend }: { trend: Performance["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ── Expanded row content ────────────────────────────────────────────────────

function ExpandedDetail({ employee }: { employee: Employee }) {
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's task breakdown */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Today&rsquo;s Task Breakdown
          </h4>
          {employee.todaysTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No tasks completed yet today.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {employee.todaysTasks.map((task, i) => (
                <div key={task.id || i} className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/30">
                  <div className="flex-shrink-0 mt-0.5">
                    {task.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{task.action}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{task.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {formatTime(task.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly schedule */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-blue-400" />
            Weekly Schedule
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Work Days</span>
              <span className="font-medium">{employee.weeklySchedule.days}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Shift</span>
              <span className="font-medium">{employee.weeklySchedule.shiftStart} – {employee.weeklySchedule.shiftEnd}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Hours / Day</span>
              <span className="font-medium">{employee.weeklySchedule.hoursPerDay}h</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Primary Task</span>
              <span className="font-medium text-right max-w-[60%]">{employee.weeklySchedule.taskLabel}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Reports To</span>
              <span className="font-medium">{employee.reportsTo || "—"}</span>
            </div>
          </div>

          {/* Performance metrics */}
          <h4 className="text-sm font-semibold flex items-center gap-2 mt-4 mb-3">
            <Activity className="h-4 w-4 text-purple-400" />
            Performance Metrics
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-background/40 border border-border/30 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Success Rate</p>
              <p className="text-lg font-bold text-green-400">{employee.performance.successRate}%</p>
            </div>
            <div className="rounded-md bg-background/40 border border-border/30 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Avg Tasks/Day</p>
              <p className="text-lg font-bold">{employee.performance.avgTasksPerDay}</p>
            </div>
            <div className="rounded-md bg-background/40 border border-border/30 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total Tasks</p>
              <p className="text-lg font-bold">{employee.performance.totalTasks}</p>
            </div>
            <div className="rounded-md bg-background/40 border border-border/30 p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Trend</p>
              <p className="text-lg font-bold flex items-center gap-1">
                <TrendIcon trend={employee.performance.trend} />
                <span className="text-sm capitalize">{employee.performance.trend}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Recent activity log */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4 lg:col-span-2">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            Recent Activity Log
          </h4>
          {employee.recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No recent activity on record.
            </p>
          ) : (
            <div className="space-y-1.5">
              {employee.recentActivity.map((a, i) => (
                <div key={a.id || i} className="flex items-center gap-3 p-2 rounded-md bg-background/40 border border-border/30">
                  <div className="flex-shrink-0">
                    {a.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.action}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatRelative(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AgentTimesheet() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/timesheet");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Authentication required. Please log in as admin.");
          return;
        }
        throw new Error(`Failed to fetch (${res.status})`);
      }
      const data = await res.json();
      setEmployees(data.data?.employees || []);
      setSummary(data.data?.summary || null);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch timesheet data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const departments = React.useMemo(() => {
    const set = new Set(employees.map((e) => e.department));
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = React.useMemo(() => {
    if (filter === "on_clock") return employees.filter((e) => e.onClock);
    if (filter === "off_duty") return employees.filter((e) => !e.onClock);
    if (filter === "by_department") {
      if (departmentFilter === "all") return employees;
      return employees.filter((e) => e.department === departmentFilter);
    }
    return employees;
  }, [employees, filter, departmentFilter]);

  const onClockCount = employees.filter((e) => e.onClock).length;
  const offDutyCount = employees.length - onClockCount;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            AI Agent Timesheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workforce management dashboard — track hours, tasks & productivity for your AI team
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

      {/* Error */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Summary header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Employees"
          value={summary?.totalEmployees ?? employees.length}
          sublabel="AI agents on roster"
          accent="bg-blue-500"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Currently On Clock"
          value={summary?.currentlyOnClock ?? onClockCount}
          sublabel={`${offDutyCount} off duty`}
          accent="bg-green-500"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tasks Today"
          value={summary?.totalTasksToday ?? 0}
          sublabel="across all agents"
          accent="bg-amber-500"
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="Avg Productivity"
          value={`${summary?.avgProductivity ?? 0}%`}
          sublabel="team average"
          accent="bg-purple-500"
        />
      </div>

      {/* Pay period + filter tabs */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Pay Period
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Week of:</span>
              <Badge variant="outline" className="text-xs border-border/60">
                {summary ? `${formatDateShort(summary.payPeriodStart)} – ${formatDateShort(summary.payPeriodEnd)}` : "Loading…"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-border/60 -mx-1 px-1 mb-0">
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              icon={<Users className="h-4 w-4" />}
              count={employees.length}
            >
              All
            </FilterButton>
            <FilterButton
              active={filter === "on_clock"}
              onClick={() => setFilter("on_clock")}
              icon={<Clock className="h-4 w-4" />}
              count={onClockCount}
            >
              On Clock
            </FilterButton>
            <FilterButton
              active={filter === "off_duty"}
              onClick={() => setFilter("off_duty")}
              icon={<Coffee className="h-4 w-4" />}
              count={offDutyCount}
            >
              Off Duty
            </FilterButton>
            <FilterButton
              active={filter === "by_department"}
              onClick={() => setFilter("by_department")}
              icon={<Briefcase className="h-4 w-4" />}
            >
              By Department
            </FilterButton>
            {filter === "by_department" && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="ml-2 h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-1 px-1 mt-3">
            {loading && employees.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Loading timesheet…</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No employees match this filter.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Employee</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Dept</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Shift</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap text-center">Hrs Today</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap text-center">Hrs/Wk</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap text-center">Tasks</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Last Activity</th>
                    <th className="py-2 px-2 text-[11px] uppercase font-medium text-muted-foreground whitespace-nowrap">Productivity</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const isExpanded = expanded === emp.id;
                    return (
                      <React.Fragment key={emp.id}>
                        <tr
                          onClick={() => setExpanded(isExpanded ? null : emp.id)}
                          className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/30 ${
                            idx % 2 === 1 ? "bg-muted/10" : ""
                          } ${isExpanded ? "bg-muted/30" : ""}`}
                        >
                          {/* Employee */}
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-full ${colorDot(emp.color)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                {emp.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{emp.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{emp.role}</p>
                              </div>
                            </div>
                          </td>
                          {/* Dept */}
                          <td className="py-2.5 px-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${colorBgSoft(emp.color)} ${colorText(emp.color)}`}>
                              {emp.department}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-2.5 px-2">
                            <StatusBadge status={emp.status} />
                          </td>
                          {/* Shift */}
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{emp.shiftStart24} – {emp.shiftEnd24}</span>
                              <span className="text-[10px] text-muted-foreground">{emp.weeklySchedule.days}</span>
                            </div>
                          </td>
                          {/* Hrs today */}
                          <td className="py-2.5 px-2 text-center font-medium">
                            {emp.hoursToday > 0 ? `${emp.hoursToday}h` : "—"}
                          </td>
                          {/* Hrs week */}
                          <td className="py-2.5 px-2 text-center font-medium">
                            {emp.hoursThisWeek > 0 ? `${emp.hoursThisWeek}h` : "—"}
                          </td>
                          {/* Tasks */}
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-lg font-bold">{emp.tasksToday}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">/ {emp.expectedTasksPerDay}</span>
                          </td>
                          {/* Last activity */}
                          <td className="py-2.5 px-2 whitespace-nowrap text-xs text-muted-foreground">
                            {formatRelative(emp.lastActivityTime)}
                          </td>
                          {/* Productivity */}
                          <td className="py-2.5 px-2">
                            <div className="flex flex-col gap-1 min-w-[80px]">
                              <ProductivityBadge score={emp.productivityScore} />
                              <Progress value={emp.productivityScore} className="h-1.5" />
                            </div>
                          </td>
                          {/* Expand chevron */}
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
                            <td colSpan={10} className="p-0">
                              <ExpandedDetail employee={emp} />
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
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-[11px] text-muted-foreground text-center">
        Timesheet data auto-refreshes every 30 seconds. Productivity scores are calculated as tasks completed ÷ expected tasks for the shift.
      </p>
    </div>
  );
}