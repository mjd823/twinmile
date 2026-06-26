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
      parts.push(`Scheduled task "${e.title}" ran at ${time}.`);
      if (e.agent) parts.push(`Handled by agent: ${e.agent}.`);
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
                {event.agentId && (
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
// Day Cell Component — square with hover expand
// ---------------------------------------------------------------------------

const MAX_VISIBLE_EVENTS = 3;

function DayCell({
  day,
  dayEvents,
  isCurrentMonth,
  isTodayDate,
  onEventClick,
}: {
  day: Date;
  dayEvents: CalendarEvent[];
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
  const remainingCount = dayEvents.length - MAX_VISIBLE_EVENTS;

  return (
    <div
      className={`relative p-1.5 border-b border-r border-border/60 flex flex-col transition-all duration-200 ${
        !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : ""
      } ${isTodayDate ? "bg-primary/5 ring-2 ring-primary/20" : ""} ${
        hovered
          ? "z-20 shadow-lg shadow-black/20 bg-card row-span-2 min-h-[200px]"
          : "min-h-[100px] max-h-[100px] overflow-hidden"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Day number */}
      <div className="text-xs font-medium mb-0.5 shrink-0 flex items-center justify-between">
        <span>{format(day, "d")}</span>
        {dayEvents.length > 0 && !hovered && (
          <span className="flex items-center gap-0.5">
            {dayEvents.slice(0, 3).map((ev, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${ev.color}`}
              />
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[9px] text-muted-foreground ml-0.5">
                +{dayEvents.length - 3}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Event list */}
      <div
        className={`flex-1 min-h-0 ${
          hovered ? "overflow-y-auto space-y-0.5" : "overflow-hidden space-y-0.5"
        }`}
      >
        {(hovered ? dayEvents : visibleEvents).map((event) => (
          <div
            key={event.id}
            className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:brightness-110 transition-all ${event.color}`}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
            title={event.title}
          >
            {event.title}
          </div>
        ))}
        {hovered && remainingCount > 0 && (
          <div className="text-[9px] text-muted-foreground px-1 py-0.5">
            {remainingCount} more event{remainingCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* "+N more" indicator when not hovered and there are hidden events */}
      {!hovered && remainingCount > 0 && (
        <div className="text-[9px] text-muted-foreground px-1 mt-auto shrink-0">
          +{remainingCount} more
        </div>
      )}
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

export function CalendarView({
  events,
  onEventClick,
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

            return (
              <DayCell
                key={day.toISOString()}
                day={day}
                dayEvents={dayEvents}
                isCurrentMonth={isCurrentMonth}
                isTodayDate={isTodayDate}
                onEventClick={onEventClick}
              />
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
