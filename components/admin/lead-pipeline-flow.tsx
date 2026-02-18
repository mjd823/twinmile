"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUOTE_PIPELINE, DRIVER_PIPELINE, type PipelineStep } from "@/lib/agent-dashboard-data";
import {
  ArrowDown,
  FileText,
  UserCheck,
  ChevronRight,
} from "lucide-react";

type PipelineType = "quote" | "driver";

export function LeadPipelineFlow() {
  const [activeType, setActiveType] = React.useState<PipelineType>("quote");

  const pipeline = activeType === "quote" ? QUOTE_PIPELINE : DRIVER_PIPELINE;

  return (
    <Card className="border border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ArrowDown className="h-6 w-6 text-primary" />
            Lead Pipeline — Step-by-Step Workflow
          </CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveType("quote")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeType === "quote"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  : "bg-muted text-muted-foreground border border-border hover:bg-accent"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Quote Lead
            </button>
            <button
              onClick={() => setActiveType("driver")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeType === "driver"
                  ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                  : "bg-muted text-muted-foreground border border-border hover:bg-accent"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Driver Lead
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {pipeline.map((step, index) => (
            <PipelineStepRow
              key={step.agentId}
              step={step}
              index={index}
              isLast={index === pipeline.length - 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineStepRow({
  step,
  index,
  isLast,
}: {
  step: PipelineStep;
  index: number;
  isLast: boolean;
}) {
  // Map color class to dot bg
  const dotColor = step.color.replace("bg-", "");

  return (
    <div className="flex gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-8 shrink-0">
        {/* Dot */}
        <div
          className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-${dotColor}/20`}
        >
          {index + 1}
        </div>
        {/* Connecting line */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px] bg-border/60" />
        )}
      </div>

      {/* Content */}
      <Link
        href={`/admin/lead-engine/agent/${step.agentId}`}
        className="flex-1 mb-3 group"
      >
        <div className="p-3 rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">
                    {step.action}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-muted/50"
                  >
                    {step.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.agentName} — {step.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
          </div>
        </div>
      </Link>
    </div>
  );
}
