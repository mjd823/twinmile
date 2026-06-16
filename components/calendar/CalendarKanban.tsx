"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Plus, Truck, UserCheck, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "cron" | "agent_action" | "pipeline" | "onboarding" | "lease" | "meeting";
  agentId?: string;
  details?: string;
  color: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "week" | "day">("month");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(e.date, day));

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(addMonths(currentMonth, direction));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (view === "month") {
    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
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
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-r border-border/60 bg-muted/30">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] p-2 border-b border-r border-border/60 relative ${
                    !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : ""
                  } ${isTodayDate ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
                >
                  <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                  <div className="space-y-1 overflow-hidden max-h-[80px]">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:shadow-sm transition-shadow ${event.color}`}
                        onClick={() => onEventClick?.(event)}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayEvents.length - 3} more
                      </div>
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

  if (view === "week") {
    const weekStart = startOfWeek(currentMonth);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Week of {format(weekStart, "MMM d, yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="w-32 p-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className={`p-2 text-center text-xs font-medium border-r border-border/60 ${isToday(day) ? "bg-primary/5 text-primary" : ""}`}>
                      <div className="font-medium">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "d")}</div>
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
                      const dayEvents = events.filter(e => 
                        isSameDay(e.date, day) && 
                        e.date.getHours() === hour
                      );
                      return (
                        <td key={day.toISOString()} className="p-1 border-r border-border/60 relative min-h-[60px]">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`absolute w-full px-1 py-0.5 text-[10px] rounded cursor-pointer ${event.color}`}
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

  return null;
}

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, iseachDayOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Plus, Truck, UserCheck, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "cron" | "agent_action" | "pipeline" | "onboarding" | "lease" | "meeting";
  agentId?: string;
  details?: string;
  color: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "week" | "day">("month");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(e.date, day));

  const navigateMonth = (direction: 1 | -1) => {
    setCurrentMonth(addMonths(currentMonth, direction));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (view === "month") {
    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
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
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-r border-border/60 bg-muted/30">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] p-2 border-b border-r border-border/60 relative ${
                    !isCurrentMonth ? "bg-muted/20 text-muted-foreground/50" : ""
                  } ${isTodayDate ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
                >
                  <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                  <div className="space-y-1 overflow-hidden max-h-[80px]">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:shadow-sm transition-shadow ${event.color}`}
                        onClick={() => onEventClick?.(event)}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayEvents.length - 3} more
                      </div>
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

  if (view === "week") {
    const weekStart = startOfWeek(currentMonth);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Week of {format(weekStart, "MMM d, yyyy")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="w-32 p-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className={`p-2 text-center text-xs font-medium border-r border-border/60 ${isToday(day) ? "bg-primary/5 text-primary" : ""}`}>
                      <div className="font-medium">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "d")}</div>
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
                      const dayEvents = events.filter(e => 
                        isSameDay(e.date, day) && 
                        e.date.getHours() === hour
                      );
                      return (
                        <td key={day.toISOString()} className="p-1 border-r border-border/60 relative min-h-[60px]">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`absolute w-full px-1 py-0.5 text-[10px] rounded cursor-pointer ${event.color}`}
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

  return null;
}

export function KanbanView({ 
  quoteLeads, 
  driverLeads, 
  leaseAgreements,
  onLeadClick 
}: { 
  quoteLeads: any[];
  driverLeads: any[];
  leaseAgreements: any[];
  onLeadClick?: (lead: any, type: "quote" | "driver" | "lease") => void;
}) {
  const quoteStages = [
    { key: "new", label: "New", color: "bg-slate-500", leads: quoteLeads.filter(l => l.status === "new") },
    { key: "qualified", label: "Qualified", color: "bg-blue-500", leads: quoteLeads.filter(l => l.status === "qualified") },
    { key: "quoted", label: "Quoted", color: "bg-indigo-500", leads: quoteLeads.filter(l => l.status === "quoted") },
    { key: "negotiating", label: "Negotiating", color: "bg-amber-500", leads: quoteLeads.filter(l => l.status === "negotiating") },
    { key: "converted", label: "Won", color: "bg-green-500", leads: quoteLeads.filter(l => l.status === "converted") },
    { key: "lost", label: "Lost", color: "bg-red-500", leads: quoteLeads.filter(l => l.status === "lost" || l.status === "archived") },
  ];

  const driverStages = [
    { key: "new", label: "Applied", color: "bg-slate-500", leads: driverLeads.filter(l => l.status === "new") },
    { key: "qualified", label: "Qualified (≥75)", color: "bg-blue-500", leads: driverLeads.filter(l => (l.score || 0) >= 75 && l.status === "new") },
    { key: "onboarding", label: "Onboarding", color: "bg-indigo-500", leads: driverLeads.filter(l => l.status === "onboarding") },
    { key: "compliance_check", label: "Compliance", color: "bg-amber-500", leads: driverLeads.filter(l => l.status === "compliance_check") },
    { key: "ready_to_dispatch", label: "Ready to Dispatch", color: "bg-green-500", leads: driverLeads.filter(l => l.status === "ready_to_dispatch") },
    { key: "lease_agreement", label: "Lease Agreement", color: "bg-purple-500", leads: leaseAgreements.filter(l => l.status === "pending_review") },
    { key: "lease_approved", label: "Lease Approved", color: "bg-purple-700", leads: leaseAgreements.filter(l => l.status === "approved") },
    { key: "rejected", label: "Rejected", color: "bg-red-500", leads: driverLeads.filter(l => l.status === "rejected") },
  ];

  const renderStage = (stage: any, type: "quote" | "driver" | "lease") => {
    const leads = stage.leads;
    return (
      <div className="min-w-[280px] max-w-[280px] flex flex-col">
        <div className={`px-3 py-2 rounded-t-lg ${stage.color} text-white flex items-center justify-between`}>
          <span className="font-medium">{stage.label}</span>
          <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
        </div>
        <div className="flex-1 p-2 space-y-2 min-h-[400px] border border-r-0 border-border/60 bg-card/50 overflow-y-auto">
          {leads.length === 0 ? (
            <div className="text-center text-muted-foreground/50 py-8 text-xs">
              No {type}s in this stage
            </div>
          ) : (
            leads.map((lead: any) => (
              <div
                key={lead._id || lead.id}
                className="p-2 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => onLeadClick?.(lead, type)}
              >
                <div className="font-medium text-sm truncate">
                  {type === "driver" ? (lead.fullName || lead.name) : (lead.name || lead.company)}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  {type === "driver" && lead.truckType && (
                    <span className="px-1 py-0.5 bg-blue-500/10 text-blue-700 rounded">{lead.truckType}</span>
                  )}
                  {lead.score && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{lead.score}</Badge>
                  )}
                  {lead.leads && lead.leads.length > 0 && (
                    <span className="px-1 py-0.5 bg-purple-500/10 text-purple-700 rounded text-[10px]">{lead.leads.length} docs</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lead.createdAt ? format(new Date(lead.createdAt), "MMM d, HH:mm") : "Unknown"}
                </div>
              </div>
            ))
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
        <Badge variant="outline" className="text-[10px]">{quoteLeads.length} total</Badge>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">{quoteStages.map(s => renderStage(s, "quote"))}</div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          Driver Pipeline
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {driverLeads.length + leaseAgreements.length} total
        </Badge>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">{driverStages.map(s => renderStage(s, "driver"))}</div>
    </div>
  );
}