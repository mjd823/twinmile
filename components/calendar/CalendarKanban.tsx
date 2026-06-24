"use client";

import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Truck,
  FileText,
  Zap,
  X,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  // Accept Date (runtime) or ISO string (after server → client serialization)
  date: Date | string;
  type: "cron" | "agent_action" | "pipeline" | "onboarding" | "lease" | "meeting";
  agentId?: string;
  details?: string;
  color: string;
  // Optional rich metadata surfaced in the detail panel
  agent?: string;
  serviceType?: string;
  origin?: string;
  destination?: string;
  estimatedValue?: number | string;
  truckType?: string;
  yearsExperience?: number | string;
  raw?: Record<string, unknown>;
}

interface PipelineData {
  quoteLeads: Record<string, unknown>[];
  driverLeads: Record<string, unknown>[];
  leaseAgreements: Record<string, unknown>[];
}

interface CronJobSummary {
  id: string;
  name: string;
  schedule: string;
  description?: string;
  skill?: string;
  lastRun: string | null;
  lastStatus: string | null;
  nextRun: string | null;
  todayCount?: number;
  enabled: boolean;
  model?: string | null;
  provider?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<CalendarEvent["type"], string> = {
  cron: "Cron Job",
  agent_action: "Agent Activity",
  pipeline: "Pipeline",
  onboarding: "Onboarding",
  lease: "Lease",
  meeting: "Meeting",
};

const TYPE_COLORS: Record<CalendarEvent["type"], string> = {
  cron: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  agent_action: "bg-primary/15 text-primary border-primary/30",
  pipeline: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  onboarding: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  lease: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  meeting: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const toSafeDate = (d: Date | string): Date =>
  d instanceof Date ? d : new Date(d);

const scheduleToHuman = (sched: string): string => {
  const [minute, hour, dom, , dow] = sched.split(" ");
  if (minute.startsWith("*/")) return `Every ${minute.slice(2)} minutes`;
  const dowMap: Record<string, string> = {
    "0": "Sunday",
    "1": "Monday",
    "2": "Tuesday",
    "3": "Wednesday",
    "4": "Thursday",
    "5": "Friday",
    "6": "Saturday",
  };
  if (dow && dow !== "*") {
    const day = dowMap[dow] || `day ${dow}`;
    return `${day} at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  if (dom && dom !== "*") return `Monthly on day ${dom} at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (hour.includes("-") && hour.includes("/")) {
    const [range, step] = hour.split("/");
    const [start] = range.split("-");
    return `Every ${step} hours from ${start.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return `Daily at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Cron Sidebar (real data from API)
// ---------------------------------------------------------------------------

function CronJobsSidebar() {
  const [jobs, setJobs] = React.useState<CronJobSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/cron-monitor");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setJobs(json?.data?.cronJobs ?? []);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <span className="text-purple-500 text-xl">⚙️</span>
          </span>
          Cron Jobs
          <Badge variant="secondary" className="text-[10px] ml-1">
            {loading ? "…" : jobs.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading cron jobs…</p>
        ) : error ? (
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cron jobs found.</p>
        ) : (
          jobs.map((job) => {
            const ok = job.lastStatus === "ok";
            const err = job.lastStatus === "error";
            return (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      ok
                        ? "bg-green-500"
                        : err
                          ? "bg-red-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{job.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {scheduleToHuman(job.schedule)}
                      {job.skill ? ` • ${job.skill}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      ok
                        ? "bg-green-500/10 text-green-400 border-green-500/30"
                        : err
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/30"
                    }`}
                  >
                    {ok ? "active" : err ? "error" : "idle"}
                  </Badge>
                  {typeof job.todayCount === "number" && (
                    <span className="text-[10px] text-muted-foreground">
                      {job.todayCount} today
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Event Detail Dialog
// ---------------------------------------------------------------------------

function EventDetailDialog({
  event,
  onOpenChange,
}: {
  event: CalendarEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {event && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${event.color}`} />
                {event.title}
              </DialogTitle>
              <DialogDescription>
                {format(toSafeDate(event.date), "EEEE, MMM d, yyyy 'at' h:mm a")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={TYPE_COLORS[event.type]}
                >
                  {TYPE_LABELS[event.type]}
                </Badge>
                {event.agentId && (
                  <Badge variant="outline" className="text-[10px]">
                    <User className="h-3 w-3 mr-1" />
                    {event.agent || event.agentId}
                  </Badge>
                )}
              </div>

              {event.details && (
                <div className="p-3 rounded-lg border border-border/60 bg-card/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Details
                  </p>
                  <p className="whitespace-pre-wrap break-words">
                    {event.details}
                  </p>
                </div>
              )}

              {event.serviceType && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {event.serviceType && (
                    <span>
                      <span className="text-foreground font-medium">
                        Service:
                      </span>{" "}
                      {String(event.serviceType)}
                    </span>
                  )}
                  {event.origin && event.destination && (
                    <span>
                      <span className="text-foreground font-medium">
                        Route:
                      </span>{" "}
                      {String(event.origin)} → {String(event.destination)}
                    </span>
                  )}
                  {event.truckType && (
                    <span>
                      <span className="text-foreground font-medium">
                        Truck:
                      </span>{" "}
                      {String(event.truckType)}
                    </span>
                  )}
                  {event.yearsExperience != null && (
                    <span>
                      <span className="text-foreground font-medium">
                        Experience:
                      </span>{" "}
                      {String(event.yearsExperience)} yrs
                    </span>
                  )}
                  {event.estimatedValue != null && (
                    <span>
                      <span className="text-foreground font-medium">
                        Value:
                      </span>{" "}
                      ${String(event.estimatedValue)}
                    </span>
                  )}
                </div>
              )}

              {event.raw && Object.keys(event.raw).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Raw record ({Object.keys(event.raw).length} fields)
                  </summary>
                  <pre className="mt-2 p-2 rounded bg-muted/30 overflow-x-auto max-h-48 text-[10px]">
                    {JSON.stringify(event.raw, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Day Events Popover (for "+N more")
// ---------------------------------------------------------------------------

function DayEventsDialog({
  day,
  events,
  onOpenChange,
  onEventSelect,
}: {
  day: Date | null;
  events: CalendarEvent[];
  onOpenChange: (open: boolean) => void;
  onEventSelect: (e: CalendarEvent) => void;
}) {
  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {format(day, "EEEE, MMM d, yyyy")}
              </DialogTitle>
              <DialogDescription>
                {events.length} event{events.length === 1 ? "" : "s"} on this
                day
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events.</p>
              ) : (
                events.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left p-3 rounded-lg border border-border/60 bg-card/50 hover:border-primary/40 hover:bg-card transition-colors flex items-start gap-3"
                    onClick={() => {
                      onEventSelect(e);
                      onOpenChange(false);
                    }}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${e.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {format(toSafeDate(e.date), "h:mm a")}
                        <span className="mx-1">•</span>
                        {TYPE_LABELS[e.type]}
                      </p>
                      {e.details && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {e.details}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Calendar View
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onMoreClick?: (day: Date) => void;
}

export function CalendarView({
  events,
  onEventClick,
  onMoreClick,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "week">("month");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(toSafeDate(e.date), day));

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(addMonths(currentMonth, direction));
  };

  const goToToday = () => setCurrentMonth(new Date());

  if (view === "week") {
    const weekStart = startOfWeek(currentMonth);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Week of {format(weekStart, "MMM d, yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView("month")}>
              Month
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="w-32 p-2 text-left text-xs font-medium text-muted-foreground">
                    Time
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`p-2 text-center text-xs font-medium border-r border-border/60 ${
                        isSameDay(day, new Date())
                          ? "bg-primary/5 text-primary"
                          : ""
                      }`}
                    >
                      <div className="font-medium">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">
                        {format(day, "d")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 24 }, (_, hour) => (
                  <tr key={hour} className="border-b border-border/60">
                    <td className="w-32 p-1 text-right text-xs text-muted-foreground pr-2">
                      {String(hour).padStart(2, "0")}:00
                    </td>
                    {weekDays.map((day) => {
                      const dayEvents = events.filter(
                        (e) =>
                          isSameDay(toSafeDate(e.date), day) &&
                          toSafeDate(e.date).getHours() === hour,
                      );
                      return (
                        <td
                          key={day.toISOString()}
                          className="p-1 border-r border-border/60 relative min-h-[60px]"
                        >
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`absolute w-full px-1 py-0.5 text-[10px] rounded cursor-pointer hover:brightness-110 ${event.color}`}
                              style={{ top: 0 }}
                              onClick={() => onEventClick?.(event)}
                            >
                              {event.title}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          {format(currentMonth, "MMMM yyyy")}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("week")}>
            Week
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-t border-l border-border/60">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-r border-border/60 bg-muted/30"
            >
              {day}
            </div>
          ))}
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isSameDay(day, new Date());
            const moreCount = dayEvents.length - 3;

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[110px] p-2 border-b border-r border-border/60 relative ${
                  !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : ""
                } ${isTodayDate ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
              >
                <div className="text-sm font-medium mb-1">
                  {format(day, "d")}
                </div>
                <div className="space-y-1 overflow-hidden max-h-[82px]">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:brightness-110 hover:scale-[1.02] transition-all ${event.color}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:text-primary/80 hover:underline cursor-pointer text-center w-full bg-primary/5 rounded px-1 py-0.5 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoreClick?.(day);
                      }}
                    >
                      +{moreCount} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Kanban View (no scrollbars — flex-wrap)
// ---------------------------------------------------------------------------

type LeadType = "quote" | "driver" | "lease";

interface Stage {
  key: string;
  label: string;
  color: string;
  leads: Record<string, unknown>[];
}

export function KanbanView({
  quoteLeads,
  driverLeads,
  leaseAgreements,
  onLeadClick,
}: {
  quoteLeads: Record<string, unknown>[];
  driverLeads: Record<string, unknown>[];
  leaseAgreements: Record<string, unknown>[];
  onLeadClick?: (lead: Record<string, unknown>, type: LeadType) => void;
}) {
  const quoteStages: Stage[] = [
    {
      key: "new",
      label: "New",
      color: "bg-slate-500",
      leads: quoteLeads.filter((l) => l.status === "new"),
    },
    {
      key: "qualified",
      label: "Qualified",
      color: "bg-blue-500",
      leads: quoteLeads.filter((l) => l.status === "qualified"),
    },
    {
      key: "quoted",
      label: "Quoted",
      color: "bg-indigo-500",
      leads: quoteLeads.filter((l) => l.status === "quoted"),
    },
    {
      key: "negotiating",
      label: "Negotiating",
      color: "bg-amber-500",
      leads: quoteLeads.filter((l) => l.status === "negotiating"),
    },
    {
      key: "converted",
      label: "Won",
      color: "bg-green-500",
      leads: quoteLeads.filter((l) => l.status === "converted"),
    },
    {
      key: "lost",
      label: "Lost",
      color: "bg-red-500",
      leads: quoteLeads.filter(
        (l) => l.status === "lost" || l.status === "archived",
      ),
    },
  ];

  const driverStages: Stage[] = [
    {
      key: "new",
      label: "Applied",
      color: "bg-slate-500",
      leads: driverLeads.filter((l) => l.status === "new"),
    },
    {
      key: "qualified",
      label: "Qualified (≥75)",
      color: "bg-blue-500",
      leads: driverLeads.filter(
        (l) =>
          (typeof l.score === "number" ? l.score : 0) >= 75 &&
          l.status === "new",
      ),
    },
    {
      key: "onboarding",
      label: "Onboarding",
      color: "bg-indigo-500",
      leads: driverLeads.filter((l) => l.status === "onboarding"),
    },
    {
      key: "compliance_check",
      label: "Compliance",
      color: "bg-amber-500",
      leads: driverLeads.filter((l) => l.status === "compliance_check"),
    },
    {
      key: "ready_to_dispatch",
      label: "Ready to Dispatch",
      color: "bg-green-500",
      leads: driverLeads.filter((l) => l.status === "ready_to_dispatch"),
    },
    {
      key: "lease_agreement",
      label: "Lease Agreement",
      color: "bg-purple-500",
      leads: leaseAgreements.filter((l) => l.status === "pending_review"),
    },
    {
      key: "lease_approved",
      label: "Lease Approved",
      color: "bg-purple-700",
      leads: leaseAgreements.filter((l) => l.status === "approved"),
    },
    {
      key: "rejected",
      label: "Rejected",
      color: "bg-red-500",
      leads: driverLeads.filter((l) => l.status === "rejected"),
    },
  ];

  const renderStage = (stage: Stage, type: LeadType) => {
    const leads = stage.leads;
    return (
      <div
        key={stage.key}
        className="flex-1 min-w-[240px] max-w-full flex flex-col rounded-lg overflow-hidden border border-border/60"
      >
        <div
          className={`px-3 py-2 ${stage.color} text-white flex items-center justify-between`}
        >
          <span className="font-medium text-sm">{stage.label}</span>
          <Badge variant="secondary" className="text-[10px]">
            {leads.length}
          </Badge>
        </div>
        <div className="p-2 space-y-2 min-h-[180px] bg-card/50 overflow-hidden">
          {leads.length === 0 ? (
            <div className="text-center text-muted-foreground/50 py-6 text-xs">
              No {type}s in this stage
            </div>
          ) : (
            leads.map((lead: any) => {
              const id = (lead._id ?? lead.id) as string | undefined;
              return (
                <div
                  key={id ?? Math.random().toString(36)}
                  className="p-2 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => onLeadClick?.(lead, type)}
                >
                  <div className="font-medium text-sm truncate">
                    {type === "driver"
                      ? (lead.fullName as string) || (lead.name as string)
                      : (lead.name as string) || (lead.company as string)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 flex-wrap">
                    {type === "driver" && lead.truckType && (
                      <span className="px-1 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                        {String(lead.truckType)}
                      </span>
                    )}
                    {typeof lead.score === "number" && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0"
                      >
                        {Number(lead.score)}
                      </Badge>
                    )}
                    {Array.isArray(lead.leads) && lead.leads.length > 0 && (
                      <span className="px-1 py-0.5 bg-purple-500/10 text-purple-300 rounded text-[10px]">
                        {lead.leads.length} docs
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {lead.createdAt
                      ? format(
                          toSafeDate(lead.createdAt as Date | string),
                          "MMM d, HH:mm",
                        )
                      : "Unknown"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Quote Pipeline
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {quoteLeads.length} total
        </Badge>
      </div>
      {/* flex-wrap: stages wrap onto multiple rows, no horizontal scrollbar */}
      <div className="flex flex-wrap gap-3">
        {quoteStages.map((s) => renderStage(s, "quote"))}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Driver Pipeline
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {driverLeads.length + leaseAgreements.length} total
        </Badge>
      </div>
      <div className="flex flex-wrap gap-3">
        {driverStages.map((s) => renderStage(s, "driver"))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar + Kanban Page (client) — tabs + detail panels + cron sidebar
// ---------------------------------------------------------------------------

interface CalendarKanbanPageProps {
  events: CalendarEvent[];
  pipeline: PipelineData;
}

export function CalendarKanbanPage({
  events,
  pipeline,
}: CalendarKanbanPageProps) {
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(
    null,
  );
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  const dayEvents = React.useMemo(() => {
    if (!selectedDay) return [];
    return events.filter((e) =>
      isSameDay(toSafeDate(e.date), selectedDay),
    );
  }, [events, selectedDay]);

  const handleLeadClick = (
    lead: Record<string, unknown>,
    type: LeadType,
  ) => {
    const createdAt = lead.createdAt as Date | string | undefined;
    const leadEvent: CalendarEvent = {
      id: (lead._id as string) ?? (lead.id as string) ?? `lead-${Math.random().toString(36)}`,
      title:
        type === "driver"
          ? `🚛 ${(lead.fullName as string) || (lead.name as string) || "Driver"}`
          : type === "lease"
            ? `📄 ${(lead.name as string) || (lead.company as string) || "Lease"}`
            : `📦 ${(lead.name as string) || (lead.company as string) || "Quote"}`,
      date: createdAt ? toSafeDate(createdAt) : new Date(),
      type: type === "driver" ? "onboarding" : type === "lease" ? "lease" : "pipeline",
      color:
        type === "driver"
          ? "bg-orange-500/80"
          : type === "lease"
            ? "bg-pink-500/80"
            : "bg-blue-500/80",
      details: (() => {
        if (type === "driver")
          return `${lead.truckType ?? "—"} • ${lead.yearsExperience ?? "?"} yrs exp • status: ${lead.status ?? "?"}`;
        if (type === "lease")
          return `Lease • status: ${lead.status ?? "?"}`;
        return `${lead.serviceType ?? ""} • ${lead.origin ?? "?"} → ${lead.destination ?? "?"} • status: ${lead.status ?? "?"}`;
      })(),
      agent: undefined,
      serviceType: lead.serviceType as string | undefined,
      origin: lead.origin as string | undefined,
      destination: lead.destination as string | undefined,
      truckType: lead.truckType as string | undefined,
      yearsExperience: lead.yearsExperience as number | string | undefined,
      estimatedValue: lead.estimatedValue as number | string | undefined,
      raw: lead,
    };
    setSelectedEvent(leadEvent);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-500 text-xl">📅</span>
            </span>
            Calendar & Kanban
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cron schedule • Agent activity • Pipeline visualization
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="calendar">
            <TabsList className="mb-4">
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <Zap className="h-4 w-4" />
                Kanban
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar">
              <CalendarView
                events={events}
                onEventClick={setSelectedEvent}
                onMoreClick={setSelectedDay}
              />
            </TabsContent>

            <TabsContent value="kanban">
              <KanbanView
                quoteLeads={pipeline.quoteLeads}
                driverLeads={pipeline.driverLeads}
                leaseAgreements={pipeline.leaseAgreements}
                onLeadClick={handleLeadClick}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <CronJobsSidebar />
        </div>
      </div>

      <EventDetailDialog
        event={selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      />
      <DayEventsDialog
        day={selectedDay}
        events={dayEvents}
        onOpenChange={(open) => {
          if (!open) setSelectedDay(null);
        }}
        onEventSelect={setSelectedEvent}
      />
    </div>
  );
}

// Re-export icons used elsewhere for backwards compatibility
export { Truck, FileText };