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
  User,
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

export type JobStatus = "on_time" | "late" | "error" | "never_ran";

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
  // Scheduled-job metadata (type "cron"): live health from agent-status logic
  status?: JobStatus;
  schedule?: string;
  freqLabel?: string;
  lastRun?: string | null;
}

interface PipelineData {
  quoteLeads: Record<string, unknown>[];
  driverLeads: Record<string, unknown>[];
  leaseAgreements: Record<string, unknown>[];
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

/** Live health of a scheduled job (mirrors /api/admin/agent-status). */
export const JOB_STATUS_META: Record<
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

const toSafeDate = (d: Date | string): Date =>
  d instanceof Date ? d : new Date(d);

const sortByTime = (a: CalendarEvent, b: CalendarEvent) =>
  toSafeDate(a.date).getTime() - toSafeDate(b.date).getTime();

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
  // Build a plain-English summary for the admin
  const buildSummary = (e: CalendarEvent): string => {
    const parts: string[] = [];
    const time = format(toSafeDate(e.date), "h:mm a");

    if (e.type === "agent_action") {
      parts.push(`${e.agent || "An agent"} performed an action at ${time}.`);
      if (e.serviceType) parts.push(`Service: ${e.serviceType}.`);
      if (e.origin && e.destination)
        parts.push(`Route: ${e.origin} → ${e.destination}.`);
      if (e.truckType) parts.push(`Truck type: ${e.truckType}.`);
      if (e.estimatedValue)
        parts.push(`Estimated value: $${e.estimatedValue}.`);
    } else if (e.type === "cron") {
      parts.push(`Scheduled job, runs at ${time}.`);
      if (e.agent) parts.push(`Handled by ${e.agent}.`);
      if (e.status)
        parts.push(`Current health: ${JOB_STATUS_META[e.status].label.toLowerCase()}.`);
    } else if (e.type === "pipeline") {
      parts.push(`Pipeline event at ${time}.`);
      if (e.serviceType) parts.push(`Service: ${e.serviceType}.`);
      if (e.origin && e.destination)
        parts.push(`Route: ${e.origin} → ${e.destination}.`);
      if (e.estimatedValue)
        parts.push(`Estimated value: $${e.estimatedValue}.`);
    } else if (e.type === "onboarding") {
      parts.push(`Onboarding activity at ${time}.`);
      if (e.truckType) parts.push(`Truck: ${e.truckType}.`);
      if (e.yearsExperience)
        parts.push(`Experience: ${e.yearsExperience} years.`);
    } else if (e.type === "lease") {
      parts.push(`Lease event at ${time}.`);
      if (e.serviceType) parts.push(`Service: ${e.serviceType}.`);
    } else if (e.type === "meeting") {
      parts.push(`Meeting scheduled at ${time}.`);
    } else {
      parts.push(`${TYPE_LABELS[e.type]} event at ${time}.`);
    }

    if (e.details) parts.push(e.details);

    return parts.join(" ");
  };

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            <div className="space-y-4 text-sm">
              {/* Admin-friendly summary */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs uppercase tracking-wide text-primary mb-1 font-semibold">
                  Summary
                </p>
                <p className="leading-relaxed">{buildSummary(event)}</p>
              </div>

              {/* Key fields grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Type
                  </p>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${TYPE_COLORS[event.type]}`}
                  >
                    {TYPE_LABELS[event.type]}
                  </Badge>
                </div>
                {event.status && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Live status
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 text-[10px] ${JOB_STATUS_META[event.status].pill}`}
                    >
                      {JOB_STATUS_META[event.status].label}
                    </Badge>
                  </div>
                )}
                {event.freqLabel && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Frequency
                    </p>
                    <p className="font-medium text-xs mt-1">{event.freqLabel}</p>
                  </div>
                )}
                {event.schedule && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Cron (UTC)
                    </p>
                    <p className="font-mono text-[11px] mt-1 break-all">
                      {event.schedule}
                    </p>
                  </div>
                )}
                {event.type === "cron" && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Last run
                    </p>
                    <p className="font-medium text-xs mt-1 tabular-nums">
                      {event.lastRun
                        ? format(new Date(event.lastRun), "MMM d, h:mm a")
                        : "Never"}
                    </p>
                  </div>
                )}
                {(event.agent || event.agentId) && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Agent
                    </p>
                    <p className="font-medium text-xs mt-1 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {event.agent || event.agentId}
                    </p>
                  </div>
                )}
                {event.serviceType && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Service
                    </p>
                    <p className="font-medium text-xs mt-1">{String(event.serviceType)}</p>
                  </div>
                )}
                {event.truckType && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Truck
                    </p>
                    <p className="font-medium text-xs mt-1">{String(event.truckType)}</p>
                  </div>
                )}
                {event.origin && event.destination && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50 col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Route
                    </p>
                    <p className="font-medium text-xs mt-1">
                      {String(event.origin)} → {String(event.destination)}
                    </p>
                  </div>
                )}
                {event.yearsExperience != null && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Experience
                    </p>
                    <p className="font-medium text-xs mt-1">{String(event.yearsExperience)} yrs</p>
                  </div>
                )}
                {event.estimatedValue != null && (
                  <div className="p-2 rounded-lg border border-border/60 bg-card/50">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Value
                    </p>
                    <p className="font-medium text-xs mt-1">${String(event.estimatedValue)}</p>
                  </div>
                )}
              </div>

              {/* Free-form details if present */}
              {event.details && (
                <div className="p-3 rounded-lg border border-border/60 bg-card/50">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Additional Notes
                  </p>
                  <p className="whitespace-pre-wrap break-words text-xs">
                    {event.details}
                  </p>
                </div>
              )}

              {/* Raw technical record — collapsed behind details */}
              {event.raw && Object.keys(event.raw).length > 0 && (
                <details className="text-xs rounded-lg border border-border/60 bg-muted/10 p-3">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                    Raw technical record ({Object.keys(event.raw).length} fields) — click to expand
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
// Day Detail Dialog — tap a day cell (essential on mobile, where hover-expand
// doesn't exist) to get every event for that day, each tappable for detail.
// ---------------------------------------------------------------------------

function DayDetailDialog({
  day,
  events,
  onOpenChange,
  onEventClick,
}: {
  day: Date | null;
  events: CalendarEvent[];
  onOpenChange: (open: boolean) => void;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const sorted = [...events].sort(sortByTime);
  const jobs = sorted.filter((e) => e.type === "cron");
  const rest = sorted.filter((e) => e.type !== "cron");

  const renderRow = (event: CalendarEvent) => (
    <button
      key={event.id}
      onClick={() => {
        onOpenChange(false);
        onEventClick?.(event);
      }}
      className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-border/40 bg-card/50 hover:border-primary/30 hover:bg-muted/30 active:bg-muted/40 transition-colors text-left"
    >
      <span className="text-[11px] font-medium text-muted-foreground tabular-nums w-16 shrink-0">
        {format(toSafeDate(event.date), "h:mm a")}
      </span>
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          event.status ? JOB_STATUS_META[event.status].dot : event.color
        }`}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-medium truncate">{event.title}</span>
        {event.details && (
          <span className="block text-[10px] text-muted-foreground truncate">
            {event.details}
          </span>
        )}
      </span>
      {event.status && (
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 py-0 shrink-0 ${JOB_STATUS_META[event.status].pill}`}
        >
          {JOB_STATUS_META[event.status].label}
        </Badge>
      )}
    </button>
  );

  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{format(day, "EEEE, MMMM d")}</DialogTitle>
              <DialogDescription>
                {events.length === 0
                  ? "Nothing scheduled or logged this day."
                  : `${jobs.length} scheduled job${jobs.length === 1 ? "" : "s"} · ${rest.length} event${rest.length === 1 ? "" : "s"}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {jobs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                    Scheduled jobs
                  </p>
                  <div className="space-y-1.5">{jobs.map(renderRow)}</div>
                </div>
              )}
              {rest.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                    Activity &amp; pipeline
                  </p>
                  <div className="space-y-1.5">{rest.map(renderRow)}</div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Day Cell — fixed height (no hover-resize jank), readable chips on desktop,
// a count pill on mobile. Tap/click anywhere opens the day sheet.
// ---------------------------------------------------------------------------

const MAX_VISIBLE_EVENTS = 3;

/** Short, readable chip title: drop the agent-name prefix ("Sofia — X" → "X"). */
function chipTitle(event: CalendarEvent): string {
  const parts = event.title.split(" — ");
  return parts.length > 1 ? parts.slice(1).join(" — ") : event.title;
}

function DayCell({
  day,
  dayEvents,
  isCurrentMonth,
  isTodayDate,
  onEventClick,
  onDayClick,
}: {
  day: Date;
  dayEvents: CalendarEvent[];
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (day: Date) => void;
}) {
  const sorted = React.useMemo(() => [...dayEvents].sort(sortByTime), [dayEvents]);
  const visibleEvents = sorted.slice(0, MAX_VISIBLE_EVENTS);
  const remainingCount = sorted.length - MAX_VISIBLE_EVENTS;
  // Job health is a LIVE state — only flag it on today's cell, not history.
  const attention =
    isTodayDate && sorted.some((e) => e.status === "late" || e.status === "error");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${format(day, "MMMM d")}: ${sorted.length} event${sorted.length === 1 ? "" : "s"}`}
      className={`relative flex min-h-[56px] cursor-pointer flex-col overflow-hidden border-b border-r border-border/60 p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 sm:min-h-[104px] sm:p-1.5 hover:bg-muted/30 active:bg-muted/40 ${
        !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : ""
      } ${isTodayDate ? "bg-primary/5" : ""}`}
      onClick={() => onDayClick?.(day)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDayClick?.(day);
        }
      }}
    >
      {/* Day number + attention flag */}
      <div className="mb-0.5 flex shrink-0 items-center justify-between text-xs font-medium tabular-nums">
        <span
          className={
            isTodayDate
              ? "-ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
              : ""
          }
        >
          {format(day, "d")}
        </span>
        {attention && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500"
            title="A scheduled job on this day is late or failed"
          />
        )}
      </div>

      {/* Mobile: one honest count pill (tap for the day sheet) */}
      {sorted.length > 0 && (
        <div className="sm:hidden mt-auto">
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
              attention ? "bg-amber-500/20 text-amber-500" : "bg-muted/60 text-muted-foreground"
            }`}
          >
            {sorted.length}
          </span>
        </div>
      )}

      {/* Desktop: up to 3 readable chips with a status/type dot */}
      <div className="hidden flex-1 min-h-0 space-y-0.5 overflow-hidden sm:block">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            className="flex cursor-pointer items-center gap-1 rounded border border-border/40 bg-card/80 px-1 py-0.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
            title={event.title}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                event.status ? JOB_STATUS_META[event.status].dot : event.color
              }`}
            />
            <span className="truncate text-[10px] leading-tight text-foreground/90">
              {chipTitle(event)}
            </span>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="px-1 text-[9px] font-medium text-muted-foreground">
            +{remainingCount} more — click day
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar View
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

/** Status legend shown under the calendar header. */
function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2 border-b border-border/60 bg-muted/20 text-[10px] text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide text-[9px]">
        Job health
      </span>
      {(Object.keys(JOB_STATUS_META) as JobStatus[]).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${JOB_STATUS_META[s].dot}`} />
          {JOB_STATUS_META[s].label}
        </span>
      ))}
      <span className="hidden sm:inline text-muted-foreground/50">·</span>
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Pipeline
      </span>
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Drivers
      </span>
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Agent activity
      </span>
    </div>
  );
}

type EventTypeFilter = "all" | "cron" | "activity" | "pipeline";

function matchesFilter(event: CalendarEvent, filter: EventTypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cron") return event.type === "cron";
  if (filter === "activity") return event.type === "agent_action";
  return event.type === "pipeline" || event.type === "onboarding" || event.type === "lease";
}

export function CalendarView({
  events,
  onEventClick,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "agenda">("month");
  const [filter, setFilter] = React.useState<EventTypeFilter>("all");
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  const filtered = React.useMemo(
    () => events.filter((e) => matchesFilter(e, filter)),
    [events, filter]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) =>
    filtered.filter((e) => isSameDay(toSafeDate(e.date), day));

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(addMonths(currentMonth, direction));
  };

  const goToToday = () => setCurrentMonth(new Date());

  const filterCounts: Record<EventTypeFilter, number> = React.useMemo(() => {
    const inMonth = events.filter((e) => isSameMonth(toSafeDate(e.date), currentMonth));
    return {
      all: inMonth.length,
      cron: inMonth.filter((e) => matchesFilter(e, "cron")).length,
      activity: inMonth.filter((e) => matchesFilter(e, "activity")).length,
      pipeline: inMonth.filter((e) => matchesFilter(e, "pipeline")).length,
    };
  }, [events, currentMonth]);

  const filterTabs: { key: EventTypeFilter; label: string }[] = [
    { key: "all", label: "Everything" },
    { key: "cron", label: "Schedule" },
    { key: "activity", label: "Agent activity" },
    { key: "pipeline", label: "Pipeline" },
  ];

  // Agenda view: the next 14 days from today, only days that have something.
  const agendaDays = React.useMemo(() => {
    if (view !== "agenda") return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => addDays(start, i))
      .map((day) => ({
        day,
        events: filtered.filter((e) => isSameDay(toSafeDate(e.date), day)).sort(sortByTime),
      }))
      .filter(({ events: evs }) => evs.length > 0);
  }, [view, filtered]);

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {view === "month" ? format(currentMonth, "MMMM yyyy") : "Next 14 days"}
          </CardTitle>
          <div className="flex items-center gap-1">
            <div className="mr-1 flex rounded-md border border-border/60 p-0.5">
              <button
                onClick={() => setView("month")}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  view === "month" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setView("agenda")}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  view === "agenda" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Agenda
              </button>
            </div>
            {view === "month" && (
              <>
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Event-type filter: tame the schedule noise with one tap */}
        <div className="flex flex-wrap gap-1">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === t.key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="ml-1 tabular-nums opacity-70">{filterCounts[t.key]}</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {view === "month" ? (
          <>
            <StatusLegend />
            <div className="grid grid-cols-7 border-t border-l border-border/60">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="border-b border-r border-border/60 bg-muted/30 p-1.5 text-center text-[10px] font-medium text-muted-foreground sm:p-2 sm:text-xs"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isSameDay(day, new Date());

                return (
                  <DayCell
                    key={day.toISOString()}
                    day={day}
                    dayEvents={dayEvents}
                    isCurrentMonth={isCurrentMonth}
                    isTodayDate={isTodayDate}
                    onEventClick={onEventClick}
                    onDayClick={setSelectedDay}
                  />
                );
              })}
            </div>
            <p className="px-3 py-2 text-[10px] text-muted-foreground sm:px-4">
              Tap any day for its full list. Times shown in your device timezone (business clock is Central).
            </p>
          </>
        ) : agendaDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <CalendarIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Nothing on the calendar for the next 14 days</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {filter === "all"
                ? "Scheduled jobs and agent activity will appear here as they're logged."
                : "Nothing matches this filter — try “Everything”."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {agendaDays.map(({ day, events: dayEvents }) => (
              <div key={day.toISOString()} className="px-3 py-3 sm:px-4">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`text-sm font-semibold ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                    {isSameDay(day, new Date()) ? "Today" : format(day, "EEEE")}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(day, "MMM d")}</span>
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-border/40 bg-card/50 p-2 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
                    >
                      <span className="w-14 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {format(toSafeDate(event.date), "h:mm a")}
                      </span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          event.status ? JOB_STATUS_META[event.status].dot : event.color
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{event.title}</span>
                        {event.details && (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {event.details}
                          </span>
                        )}
                      </span>
                      {event.status && (
                        <Badge
                          variant="outline"
                          className={`shrink-0 px-1.5 py-0 text-[9px] ${JOB_STATUS_META[event.status].pill}`}
                        >
                          {JOB_STATUS_META[event.status].label}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DayDetailDialog
        day={selectedDay}
        events={selectedDay ? getEventsForDay(selectedDay) : []}
        onOpenChange={(open) => {
          if (!open) setSelectedDay(null);
        }}
        onEventClick={onEventClick}
      />
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
      // Mutually exclusive with "Qualified (≥75)" below — no double counting.
      leads: driverLeads.filter(
        (l) =>
          l.status === "new" &&
          (typeof l.score === "number" ? l.score : 0) < 75,
      ),
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
            leads.map((lead: Record<string, unknown>) => {
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
                    {type === "driver" && typeof lead.truckType === "string" && (
                      <span className="px-1 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                        {lead.truckType}
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
                    {Array.isArray(lead.leads) && (lead.leads as unknown[]).length > 0 && (
                      <span className="px-1 py-0.5 bg-purple-500/10 text-purple-300 rounded text-[10px]">
                        {(lead.leads as unknown[]).length} docs
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
// Calendar + Kanban Page (client) — tabs + detail panels (no cron sidebar)
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
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-500 text-xl">📅</span>
            </span>
            Calendar & Kanban
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Live work schedule from the cron registry • Agent activity • Pipeline
          </p>
        </div>
      </div>

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

      <EventDetailDialog
        event={selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
}

// Re-export icons used elsewhere for backwards compatibility
export { Truck, FileText };
