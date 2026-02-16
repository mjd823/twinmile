"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOL_DESCRIPTIONS, AGENT_ACTIONS, AGENT_DEPARTMENTS } from "@/lib/agent-dashboard-data";
import { clientAIActivityEngine } from "@/lib/client-ai-activity-engine";
import {
  Crown,
  Users,
  Truck,
  UserCheck,
  Megaphone,
  DollarSign,
  Heart,
  Target,
  Activity,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Wrench,
  GitBranch,
  Clock,
  Zap,
  Loader2,
} from "lucide-react";

interface AIEmployee {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  status: "active" | "idle" | "busy";
  currentTask: string;
  performance: {
    tasksCompleted: number;
    successRate: number;
  };
  color: string;
  tools: string[];
  reportsTo?: string;
}

interface AgentModalProps {
  employee: AIEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityFeed: any[];
  onActionComplete: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Crown: <Crown className="h-5 w-5" />,
  DollarSign: <DollarSign className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  UserCheck: <UserCheck className="h-5 w-5" />,
  Megaphone: <Megaphone className="h-5 w-5" />,
  Heart: <Heart className="h-5 w-5" />,
  Target: <Target className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
};

export function AgentModal({ employee, open, onOpenChange, activityFeed, onActionComplete }: AgentModalProps) {
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionResult, setActionResult] = React.useState<any>(null);

  if (!employee) return null;

  const agentAction = AGENT_ACTIONS[employee.id];
  const department = AGENT_DEPARTMENTS[employee.id] || "General";

  // Filter activity feed for this agent
  const agentActivities = activityFeed.filter(
    (a) => a.agent?.includes(employee.name.split(" ")[1]) || a.agent?.includes(employee.name)
  );

  const handleAgentAction = async () => {
    if (!agentAction) return;
    setActionLoading(true);
    setActionResult(null);

    try {
      const result = await clientAIActivityEngine.handleDashboardAction(agentAction.action);
      setActionResult(result);
      onActionComplete();
    } catch (error) {
      setActionResult({
        success: false,
        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/15 text-green-400 border-green-500/30";
      case "busy": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "idle": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${employee.color}/15`}>
              {employee.icon}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{employee.name}</DialogTitle>
              <DialogDescription className="text-sm">
                {employee.role} · {department}
              </DialogDescription>
            </div>
            <Badge className={getStatusColor(employee.status)}>
              {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Reporting Chain */}
          {employee.reportsTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span>Reports to <span className="font-medium text-foreground">{employee.reportsTo}</span></span>
            </div>
          )}

          {/* Current Task */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Task</span>
              </div>
              <p className="text-sm text-foreground">{employee.currentTask}</p>
            </CardContent>
          </Card>

          {/* Primary Action */}
          {agentAction && (
            <Card className={`border-border/60 ${employee.color}/5`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primary Action</span>
                    </div>
                    <p className="font-semibold text-foreground">{agentAction.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{agentAction.description}</p>
                  </div>
                  <Button
                    onClick={handleAgentAction}
                    disabled={actionLoading}
                    className={`ml-4 ${employee.color.replace('bg-', 'bg-').replace('/500', '-600')} hover:opacity-90`}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {actionLoading ? "Running..." : "Execute"}
                  </Button>
                </div>

                {/* Action Result */}
                {actionResult && (
                  <div className={`mt-3 p-3 rounded-lg border ${actionResult.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                    <div className="flex items-center gap-2">
                      {actionResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      )}
                      <span className="text-sm font-medium text-foreground">{actionResult.message}</span>
                    </div>
                    {actionResult.details && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(actionResult.details).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}:</span>{" "}
                            <span className="font-medium text-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tools */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">AI Tools</span>
            </div>
            <TooltipProvider delayDuration={200}>
              <div className="grid gap-2">
                {employee.tools.map((toolKey) => {
                  const tool = TOOL_DESCRIPTIONS[toolKey];
                  if (!tool) return null;
                  const usage = tool.agentUsage[employee.id] || tool.description;
                  return (
                    <Tooltip key={toolKey}>
                      <TooltipTrigger asChild>
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-border transition-colors cursor-default">
                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/5 shrink-0">
                            {tool.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground leading-relaxed">{usage}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-semibold">{tool.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>

          {/* Performance */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{employee.performance.tasksCompleted}</div>
                <div className="text-xs text-muted-foreground">Tasks Completed</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{employee.performance.successRate}%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          {agentActivities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Recent Activity</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {agentActivities.slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-border/60 bg-card">
                    <p className="text-xs text-foreground">{activity.activity}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{activity.timeAgo || "Recently"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
