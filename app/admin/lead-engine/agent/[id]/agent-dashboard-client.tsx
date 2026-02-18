"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentWorkflowTimeline } from "@/components/admin/agent-workflow-timeline";
import { clientAIActivityEngine } from "@/lib/client-ai-activity-engine";
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Clock,
  Wrench,
  Zap,
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  BarChart3,
} from "lucide-react";

interface AgentTool {
  key: string;
  name: string;
  description: string;
  usage: string;
}

interface AgentDashboardClientProps {
  agentId: string;
  name: string;
  role: string;
  department: string;
  color: string;
  reportsTo?: string;
  action: { action: string; label: string; description: string; icon: string } | null;
  tools: AgentTool[];
  recentActivity: any[];
}

export function AgentDashboardClient({
  agentId,
  name,
  role,
  department,
  color,
  reportsTo,
  action,
  tools,
  recentActivity,
}: AgentDashboardClientProps) {
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionResult, setActionResult] = React.useState<any>(null);

  const handleAction = async () => {
    if (!action) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const result = await clientAIActivityEngine.handleDashboardAction(action.action);
      setActionResult(result);
    } catch (error) {
      setActionResult({
        success: false,
        message: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/admin/lead-engine"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Business Center
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className={`p-4 rounded-xl ${color}/15`}>
          <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm`}>
            {name.split(" ").map((n) => n[0]).join("")}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{name}</h1>
          <p className="text-muted-foreground">{role} · {department}</p>
          {reportsTo && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              Reports to <span className="font-medium text-foreground">{reportsTo}</span>
            </div>
          )}
        </div>
        <Badge className="bg-green-500/15 text-green-400 border border-green-500/30">Active</Badge>
      </div>

      <div className="space-y-6">
        {/* Primary Action */}
        {action && (
          <Card className={`border-border/60 ${color}/5`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primary Action</span>
                  </div>
                  <p className="font-semibold text-lg text-foreground">{action.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                </div>
                <Button onClick={handleAction} disabled={actionLoading} size="lg">
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {actionLoading ? "Running..." : "Execute"}
                </Button>
              </div>
              {actionResult && (
                <div className={`mt-4 p-3 rounded-lg border ${actionResult.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
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

        {/* Workflow Timeline */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentWorkflowTimeline agentId={agentId} />
          </CardContent>
        </Card>

        {/* AI Tools */}
        {tools.length > 0 && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                AI Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={200}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tools.map((tool) => (
                    <Tooltip key={tool.key}>
                      <TooltipTrigger asChild>
                        <div className="p-3 rounded-lg border border-border/60 bg-card hover:border-border transition-colors cursor-default">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/5">
                              {tool.name}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{tool.usage || tool.description}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-semibold text-xs">{tool.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        )}

        {/* Performance Stats */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="text-2xl font-bold text-green-400">{recentActivity.length}</div>
                <div className="text-xs text-muted-foreground">Actions Logged</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="text-2xl font-bold text-blue-400">
                  {recentActivity.filter((a) => a.success !== false).length}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="text-2xl font-bold text-purple-400">
                  {recentActivity.length > 0
                    ? `${Math.round((recentActivity.filter((a) => a.success !== false).length / recentActivity.length) * 100)}%`
                    : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/60 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{activity.action || activity.activity || "Action performed"}</p>
                        {activity.details && (
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {Object.entries(activity.details).slice(0, 4).map(([key, value]) => (
                              <span key={key} className="text-[10px] text-muted-foreground">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {activity.timestamp
                          ? new Date(activity.timestamp).toLocaleString()
                          : "Recently"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity logged yet. Execute the primary action above to start.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
