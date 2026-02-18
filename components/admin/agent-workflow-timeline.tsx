"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { AGENT_WORKFLOWS, TOOL_DESCRIPTIONS, type WorkflowStep } from "@/lib/agent-dashboard-data";
import { Wrench, CheckCircle2, Circle } from "lucide-react";

interface AgentWorkflowTimelineProps {
  agentId: string;
  filterLeadType?: "quote" | "driver" | null;
}

export function AgentWorkflowTimeline({ agentId, filterLeadType }: AgentWorkflowTimelineProps) {
  const steps = AGENT_WORKFLOWS[agentId] || [];
  const [activeFilter, setActiveFilter] = React.useState<"quote" | "driver" | "all">(filterLeadType || "all");

  const filteredSteps = activeFilter === "all"
    ? steps
    : steps.filter((s) => s.leadTypes.includes(activeFilter));

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "quote", "driver"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveFilter(t)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeFilter === t
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border hover:bg-accent"
            }`}
          >
            {t === "all" ? "All Leads" : t === "quote" ? "Quote Leads" : "Driver Leads"}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {filteredSteps.map((step, index) => (
          <WorkflowStepRow
            key={step.step}
            step={step}
            index={index}
            isLast={index === filteredSteps.length - 1}
            agentId={agentId}
          />
        ))}
        {filteredSteps.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No workflow steps for this lead type.
          </p>
        )}
      </div>
    </div>
  );
}

function WorkflowStepRow({
  step,
  index,
  isLast,
  agentId,
}: {
  step: WorkflowStep;
  index: number;
  isLast: boolean;
  agentId: string;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold">
          {step.step}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[16px] bg-border/60" />}
      </div>

      {/* Content */}
      <div className="flex-1 mb-4 pb-0">
        <div className="p-3 rounded-lg border border-border/60 bg-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {step.leadTypes.map((lt) => (
                <Badge
                  key={lt}
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${
                    lt === "quote"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                  }`}
                >
                  {lt}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tools used in this step */}
          {step.tools && step.tools.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <Wrench className="h-3 w-3 text-muted-foreground/60" />
              {step.tools.map((toolKey) => {
                const tool = TOOL_DESCRIPTIONS[toolKey];
                return (
                  <Badge
                    key={toolKey}
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 bg-primary/5 text-muted-foreground border-border/60"
                  >
                    {tool?.name || toolKey}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
