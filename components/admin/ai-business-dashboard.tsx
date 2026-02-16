"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { clientAIActivityEngine } from "@/lib/client-ai-activity-engine";
import { AgentModal } from "@/components/admin/agent-modal";
import { TOOL_DESCRIPTIONS } from "@/lib/agent-dashboard-data";
import { 
  Crown,
  Users,
  Truck,
  UserCheck,
  Megaphone,
  DollarSign,
  Heart,
  Target,
  TrendingUp,
  Activity,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye
} from "lucide-react";

// AI Employee Interface
interface AIEmployee {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'busy';
  currentTask: string;
  performance: {
    tasksCompleted: number;
    successRate: number;
  };
  color: string;
  tools: string[];
  reportsTo?: string;
}

// Business Metrics Interface
interface BusinessMetrics {
  leadsThisWeek: number;
  revenueThisMonth: number;
  customerSatisfaction: number;
  teamProductivity: number;
  monthlyGoal: number;
  goalProgress: number;
}

interface AIBusinessDashboardProps {
  onActionClick?: (action: string) => void;
}

export function AIBusinessDashboard({ onActionClick }: AIBusinessDashboardProps) {
  const [lastUpdated, setLastUpdated] = React.useState<string>('');
  
  React.useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
    const interval = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString());
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const [employees, setEmployees] = React.useState<AIEmployee[]>([
    {
      id: 'ceo',
      name: 'Alexandra Sterling',
      role: 'Chief Executive Officer',
      icon: <Crown className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-purple-500',
      tools: ['web_search', 'code_interpreter', 'browser_automation', 'wolfram_alpha']
    },
    {
      id: 'sales',
      name: 'Marcus Chen',
      role: 'Sales Director',
      icon: <Users className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-blue-500',
      tools: ['web_search', 'code_interpreter'],
      reportsTo: 'Alexandra Sterling'
    },
    {
      id: 'operations',
      name: 'David Kumar',
      role: 'Operations Director',
      icon: <Truck className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-green-500',
      tools: ['web_search', 'code_interpreter', 'wolfram_alpha'],
      reportsTo: 'Alexandra Sterling'
    },
    {
      id: 'hr',
      name: 'Jennifer Foster',
      role: 'HR Director',
      icon: <UserCheck className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-orange-500',
      tools: ['web_search', 'code_interpreter'],
      reportsTo: 'Alexandra Sterling'
    },
    {
      id: 'marketing',
      name: 'Isabella Martinez',
      role: 'Marketing Director',
      icon: <Megaphone className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-pink-500',
      tools: ['web_search', 'browser_automation', 'code_interpreter'],
      reportsTo: 'Alexandra Sterling'
    },
    {
      id: 'finance',
      name: 'Robert Chang',
      role: 'Finance Director',
      icon: <DollarSign className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-yellow-500',
      tools: ['code_interpreter', 'wolfram_alpha', 'web_search'],
      reportsTo: 'Alexandra Sterling'
    },
    {
      id: 'customer_success',
      name: 'Emily Watson',
      role: 'Customer Success Manager',
      icon: <Heart className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-red-500',
      tools: ['web_search', 'visit_website'],
      reportsTo: 'Marcus Chen'
    },
    {
      id: 'lead_generation',
      name: 'Sofia Rodriguez',
      role: 'Lead Generation Specialist',
      icon: <Target className="h-5 w-5" />,
      status: 'idle',
      currentTask: 'Waiting for data…',
      performance: { tasksCompleted: 0, successRate: 0 },
      color: 'bg-indigo-500',
      tools: ['web_search', 'browser_automation', 'code_interpreter'],
      reportsTo: 'Marcus Chen'
    }
  ]);

  const [metrics, setMetrics] = React.useState<BusinessMetrics>({
    leadsThisWeek: 0,
    revenueThisMonth: 0,
    customerSatisfaction: 0,
    teamProductivity: 0,
    monthlyGoal: 50000,
    goalProgress: 0
  });
  const [loading, setLoading] = React.useState(true);

  const [activityFeed, setActivityFeed] = React.useState<any[]>([]);
  const [supervisorReport, setSupervisorReport] = React.useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = React.useState<AIEmployee | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [expandedActivity, setExpandedActivity] = React.useState<number | null>(null);

  // Fetch real AI data on component mount
  React.useEffect(() => {
    fetchRealAIData();
    // Set up interval to refresh data
    const interval = setInterval(fetchRealAIData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRealAIData = async () => {
    try {
      const currentActivity = await clientAIActivityEngine.getCurrentActivity();
      const feed = clientAIActivityEngine.getActivityFeed(15);
      const supervisor = clientAIActivityEngine.getSupervisorReport();

      setActivityFeed(feed);
      setSupervisorReport(supervisor);

      // Update metrics ONLY from real database data
      const dbStats = currentActivity.databaseStats;
      if (dbStats) {
        const revenue = dbStats.totalRevenue ?? 0;
        setMetrics({
          leadsThisWeek: dbStats.totalLeads ?? 0,
          revenueThisMonth: revenue,
          customerSatisfaction: dbStats.customers > 0 ? 100 : 0,
          teamProductivity: dbStats.totalLeads > 0 ? 100 : 0,
          monthlyGoal: 50000,
          goalProgress: Math.min(100, (revenue / 50000) * 100),
        });
      }

      // Match each employee to their real activity from the feed
      if (currentActivity.recentActivities && currentActivity.recentActivities.length > 0) {
        setEmployees(prev => prev.map(emp => {
          const match = currentActivity.recentActivities.find((a: any) =>
            a.agent.includes(emp.name.split(' ')[1])
          );
          if (match) {
            return {
              ...emp,
              status: 'active' as const,
              currentTask: match.activity,
              performance: {
                tasksCompleted: emp.performance.tasksCompleted + 1,
                successRate: 100,
              },
            };
          }
          return { ...emp, status: 'idle' as const, currentTask: 'No recent activity' };
        }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch real AI data:', error);
      setLoading(false);
    }
  };

  const openAgentModal = (employee: AIEmployee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'busy': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'idle': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Agent Modal */}
      <AgentModal
        employee={selectedEmployee}
        open={modalOpen}
        onOpenChange={setModalOpen}
        activityFeed={activityFeed}
        onActionComplete={fetchRealAIData}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          AI Business Operations Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Your AI team is working 24/7 to grow your business
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Badge className="bg-green-500/15 text-green-400 border border-green-500/30">
            System Status: Operational{lastUpdated && ` • ${lastUpdated}`}
          </Badge>
          {supervisorReport && (
            <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Eye className="h-3 w-3 mr-1" />
              {supervisorReport.systemHealth.activeAgents} Agents Active
            </Badge>
          )}
        </div>
      </div>

      {/* Business Health Overview + Goal Progress (merged) */}
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-green-400" />
            Business Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{metrics.leadsThisWeek}</div>
              <div className="text-sm text-muted-foreground">Active Leads</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(metrics.revenueThisMonth)}</div>
              <div className="text-sm text-muted-foreground">Revenue</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="text-2xl font-bold text-purple-400">{metrics.customerSatisfaction > 0 ? `${metrics.customerSatisfaction.toFixed(0)}%` : '—'}</div>
              <div className="text-sm text-muted-foreground">Satisfaction</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="text-2xl font-bold text-orange-400">{formatCurrency(metrics.monthlyGoal)}</div>
              <div className="text-sm text-muted-foreground">Monthly Goal</div>
            </div>
          </div>
          {/* Goal Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-muted-foreground">Monthly Goal Progress</span>
              <span className="font-semibold text-foreground">{formatCurrency(metrics.revenueThisMonth)} / {formatCurrency(metrics.monthlyGoal)}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-4">
              <div
                className="bg-gradient-to-r from-green-600 to-green-500 h-4 rounded-full flex items-center justify-center text-white font-semibold text-[10px]"
                style={{ width: `${Math.max(metrics.goalProgress, 2)}%` }}
              >
                {metrics.goalProgress.toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live AI Activity Feed (expandable items) */}
      {activityFeed.length > 0 && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-6 w-6 text-purple-400" />
              Live AI Activity Feed
            </CardTitle>
            <CardDescription>Click an item for details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activityFeed.map((activity, index) => (
                <div
                  key={`${activity.timestamp}-${index}`}
                  className="rounded-lg border border-border/60 bg-card hover:border-border transition-colors cursor-pointer"
                  onClick={() => setExpandedActivity(expandedActivity === index ? null : index)}
                >
                  <div className="flex items-start gap-3 p-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      activity.type === 'supervision' ? 'bg-purple-500' :
                      activity.type === 'lead_processing' ? 'bg-blue-500' :
                      activity.type === 'prospecting' ? 'bg-green-500' :
                      activity.type === 'marketing' ? 'bg-pink-500' :
                      activity.type === 'operations' ? 'bg-orange-500' :
                      activity.type === 'finance' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{activity.agent}</span>
                        <span className="text-xs text-muted-foreground">{activity.timeAgo}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{activity.activity}</p>
                    </div>
                    {activity.details && (
                      expandedActivity === index
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    )}
                  </div>
                  {/* Expanded details */}
                  {expandedActivity === index && activity.details && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/40 mx-3 mt-0">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
                        {Object.entries(activity.details).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
                            <span className="font-medium text-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Team — Clickable Cards with Tooltips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-blue-400" />
            Your AI Team
          </CardTitle>
          <CardDescription>
            Click any employee to open their dashboard and trigger actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={300}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="border-border/60 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => openAgentModal(employee)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${employee.color}/15 group-hover:scale-110 transition-transform`}>
                        {employee.icon}
                      </div>
                      <Badge className={getStatusColor(employee.status)}>
                        {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-semibold text-foreground">{employee.name}</h4>
                      <p className="text-sm text-muted-foreground">{employee.role}</p>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground/70 mb-1">Currently:</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{employee.currentTask}</p>
                    </div>

                    <div className="mt-3 flex justify-between text-xs">
                      <span className="text-muted-foreground">Tasks: {employee.performance.tasksCompleted}</span>
                      <span className="text-muted-foreground">Success: {employee.performance.successRate}%</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {employee.tools.map((tool) => {
                        const toolInfo = TOOL_DESCRIPTIONS[tool];
                        const usage = toolInfo?.agentUsage[employee.id] || toolInfo?.description || '';
                        return (
                          <Tooltip key={tool}>
                            <TooltipTrigger asChild>
                              <span onClick={(e) => e.stopPropagation()}>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 text-muted-foreground border-border/60 cursor-help">
                                  {tool.replace(/_/g, ' ')}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-semibold text-xs">{toolInfo?.name || tool}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{usage}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    {employee.reportsTo && (
                      <p className="mt-2 text-[10px] text-muted-foreground/60">
                        Reports to {employee.reportsTo}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Emergency Contact (simplified footer) */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span>Need human assistance?</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs">
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs">
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
        </div>
      </div>
    </div>
  );
}
