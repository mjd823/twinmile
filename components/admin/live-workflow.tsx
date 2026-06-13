"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUOTE_PIPELINE, type PipelineStep } from "@/lib/agent-dashboard-data";
import {
  Activity,
  ChevronRight,
  Zap,
} from "lucide-react";

interface LiveWorkflowProps {
  employees: Array<{
    id: string;
    name: string;
    role: string;
    status: "active" | "idle" | "busy";
    currentTask: string;
    color: string;
  }>;
  activityFeed: any[];
}

export function LiveWorkflow({ employees, activityFeed }: LiveWorkflowProps) {
  const pipeline = QUOTE_PIPELINE;

  // Match employees to pipeline steps
  const stepsWithAgents = pipeline.map((step) => {
    const agent = employees.find((e) => e.id === step.agentId);
    const recentActivity = activityFeed.filter(
      (a) =>
        a.agent?.name?.includes(step.agentName.split(" ")[1]) ||
        a.agent?.name?.includes(step.agentName)
    );
    return { ...step, agent, recentActivity };
  });

  return (
    <Card className="border border-border/60 overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Zap className="h-6 w-6 text-yellow-400" />
          </motion.div>
          Live Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {stepsWithAgents.map((step, index) => (
            <WorkflowStep
              key={step.agentId}
              step={step}
              index={index}
              isLast={index === stepsWithAgents.length - 1}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowStep({
  step,
  index,
  isLast,
}: {
  step: PipelineStep & {
    agent?: LiveWorkflowProps["employees"][0];
    recentActivity: any[];
  };
  index: number;
  isLast: boolean;
}) {
  const hasActivity = step.recentActivity.length > 0;
  const isActive = step.agent?.status === "active";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex gap-4"
    >
      {/* Timeline column */}
      <div className="flex flex-col items-center w-10 shrink-0">
        {/* Status dot with animation */}
        <Link href={`/admin/lead-engine/agent/${step.agentId}`}>
          <motion.div
            whileHover={{ scale: 1.1 }}
            className={`w-10 h-10 rounded-full ${step.color} flex items-center justify-center text-white font-bold text-sm shadow-lg relative`}
          >
            {index + 1}
            {isActive && (
              <motion.span
                className="absolute inset-0 rounded-full bg-white/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        </Link>
        {/* Connecting line */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[32px] bg-gradient-to-b from-border via-border to-transparent" />
        )}
      </div>

      {/* Content */}
      <Link
        href={`/admin/lead-engine/agent/${step.agentId}`}
        className="flex-1 mb-4 group"
      >
        <motion.div
          whileHover={{ scale: 1.01, x: 4 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`p-4 rounded-xl border transition-all duration-300 ${
            hasActivity
              ? "border-primary/40 bg-card shadow-sm"
              : "border-border/60 bg-card/50 hover:border-border"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-base text-foreground">
                  {step.action}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0 bg-muted/50"
                >
                  {step.role}
                </Badge>
                {hasActivity && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex h-2 w-2 rounded-full bg-green-500"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>

              {/* Agent info */}
              {step.agent && (
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full ${step.agent.color} flex items-center justify-center text-white text-xs font-bold`}
                  >
                    {step.agent.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {step.agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {step.agent.currentTask}
                    </p>
                  </div>
                  <StatusBadge status={step.agent.status} />
                </div>
              )}

              {/* Recent activity preview */}
              {step.recentActivity.slice(0, 2).map((activity, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
                >
                  <Activity className="h-3 w-3 inline mr-1" />
                  {activity.activity}
                </motion.div>
              ))}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    busy: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    idle: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-0 ${colors[status as keyof typeof colors]}`}
    >
      {status === "active" && (
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-current mr-1"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
