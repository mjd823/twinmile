"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Zap, 
  ArrowUpRight, 
  Target,
  Truck,
  UserCheck,
  Crown,
  Brain,
  Network,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  BarChart3,
  Eye,
  Settings
} from "lucide-react";

// Agent Activity Interface
interface AgentActivity {
  agentId: string;
  name: string;
  role: string;
  department: string;
  isActive: boolean;
  currentTask: string;
  performance: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
    collaborationScore: number;
    innovationScore: number;
  };
  relationships: Array<{
    id: string;
    relationshipType: string;
    strength: number;
    lastInteraction: string;
  }>;
  recentInteractions: Array<{
    timestamp: string;
    agent: string;
    context: string;
    outcome: string;
    sentiment: string;
  }>;
  personality: {
    communicationStyle: string;
    decisionMakingStyle: string;
    emotionalIntelligence: number;
  };
}

// Workflow Visualization Interface
interface WorkflowStep {
  id: string;
  agent: string;
  action: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  tools: string[];
  collaboration?: Array<{
    agent: string;
    type: string;
  }>;
}

interface BusinessMetrics {
  totalAgents: number;
  activeAgents: number;
  tasksCompleted: number;
  averageSuccessRate: number;
  collaborationEvents: number;
  autonomousDecisions: number;
  humanInterventions: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
}

// Props for the dashboard
interface OversightDashboardProps {
  agents: AgentActivity[];
  workflows: WorkflowStep[];
  metrics: BusinessMetrics;
  onIntervention?: (agentId: string, reason: string) => void;
  onOverrideDecision?: (agentId: string, newDecision: any) => void;
}

export function OversightDashboard({ agents, workflows, metrics, onIntervention, onOverrideDecision }: OversightDashboardProps) {
  const [selectedAgent, setSelectedAgent] = React.useState<AgentActivity | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<WorkflowStep | null>(null);
  const [viewMode, setViewMode] = React.useState<'overview' | 'agents' | 'workflows' | 'collaboration'>('overview');

  // Calculate real-time insights
  const getSystemHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-400 bg-green-500/15';
      case 'good': return 'text-blue-400 bg-blue-500/15';
      case 'warning': return 'text-yellow-400 bg-yellow-500/15';
      case 'critical': return 'text-red-400 bg-red-500/15';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Overview Mode
  if (viewMode === 'overview') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-400" />
              AI Business Oversight
            </h2>
            <p className="text-muted-foreground">
              Real-time monitoring of autonomous business operations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Full Screen
            </Button>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-400" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getSystemHealthColor(metrics.systemHealth)}>
                {metrics.systemHealth.toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                All systems operational
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-green-400" />
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {metrics.activeAgents}/{metrics.totalAgents}
              </div>
              <p className="text-xs text-muted-foreground">
                Agents currently working
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {metrics.averageSuccessRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Task completion success
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="h-4 w-4 text-orange-400" />
                Collaborations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-400">
                {metrics.collaborationEvents}
              </div>
              <p className="text-xs text-muted-foreground">
                Agent interactions today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common oversight and intervention tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Button className="h-20 flex-col gap-2" variant="outline">
                <Users className="h-6 w-6" />
                <span>View All Agents</span>
              </Button>
              <Button className="h-20 flex-col gap-2" variant="outline">
                <Zap className="h-6 w-6" />
                <span>Active Workflows</span>
              </Button>
              <Button className="h-20 flex-col gap-2" variant="outline">
                <MessageSquare className="h-6 w-6" />
                <span>Collaboration Map</span>
              </Button>
              <Button className="h-20 flex-col gap-2" variant="outline">
                <BarChart3 className="h-6 w-6" />
                <span>Performance Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Live Activity Feed
            </CardTitle>
            <CardDescription>
              Real-time agent activities and decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {agents.flatMap(agent => 
                agent.recentInteractions.map((interaction, index) => (
                  <div key={`${agent.agentId}-${index}`} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{agent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(interaction.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{interaction.context}</p>
                      <p className="text-sm mt-1">{interaction.outcome}</p>
                    </div>
                    <Badge className={getSentimentColor(interaction.sentiment)}>
                      {interaction.sentiment}
                    </Badge>
                  </div>
                ))
              ).slice(0, 10)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Agents View
  if (viewMode === 'agents') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Agent Status Overview
          </h2>
          <Button onClick={() => setViewMode('overview')} variant="outline">
            Back to Overview
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.agentId} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <Badge className={agent.isActive ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}>
                    {agent.isActive ? 'Active' : 'Idle'}
                  </Badge>
                </div>
                <CardDescription>{agent.role} • {agent.department}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Current Task:</p>
                    <p className="text-sm text-muted-foreground">{agent.currentTask}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Success Rate:</span>
                      <p className="text-green-400">{agent.performance.successRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="font-medium">Tasks:</span>
                      <p>{agent.performance.tasksCompleted}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedAgent(agent)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    {onIntervention && (
                      <Button size="sm" variant="outline" onClick={() => onIntervention(agent.agentId, 'Manual review requested')}>
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Intervene
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Workflows View
  if (viewMode === 'workflows') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Active Workflows
          </h2>
          <Button onClick={() => setViewMode('overview')} variant="outline">
            Back to Overview
          </Button>
        </div>

        <div className="space-y-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{workflow.action}</h4>
                    <p className="text-sm text-muted-foreground">
                      Agent: {workflow.agent} • Started: {new Date(workflow.startTime).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={
                    workflow.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                    workflow.status === 'active' ? 'bg-blue-500/15 text-blue-400' :
                    workflow.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                    'bg-muted text-muted-foreground'
                  }>
                    {workflow.status}
                  </Badge>
                </div>
                
                {workflow.tools.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {workflow.tools.map((tool, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {workflow.collaboration && workflow.collaboration.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">Collaboration:</p>
                    <div className="flex gap-2 flex-wrap">
                      {workflow.collaboration.map((collab, index) => (
                        <Badge key={index} variant="outline" className="text-xs bg-purple-500/15 text-purple-400">
                          {collab.agent} ({collab.type})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Collaboration View
  if (viewMode === 'collaboration') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Agent Collaboration Network
          </h2>
          <Button onClick={() => setViewMode('overview')} variant="outline">
            Back to Overview
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.agentId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {agent.name}'s Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agent.relationships.map((rel, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="font-medium text-sm">{rel.relationshipType}</p>
                        <p className="text-xs text-muted-foreground">
                          Last: {new Date(rel.lastInteraction).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">Strength: {rel.strength}/10</div>
                        <div className="w-16 h-2 bg-secondary rounded-full mt-1">
                          <div 
                            className="h-2 bg-blue-500 rounded-full" 
                            style={{ width: `${rel.strength * 10}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
