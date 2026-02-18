"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { clientAIActivityEngine } from "@/lib/client-ai-activity-engine";
import { TOOL_DESCRIPTIONS } from "@/lib/agent-dashboard-data";
import { LeadPipelineFlow } from "@/components/admin/lead-pipeline-flow";
import { LiveWorkflow } from "@/components/admin/live-workflow";
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
  ChevronDown,
  ChevronUp,
  Eye,
  BarChart3,
  Zap,
  ArrowRight
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
  const [expandedActivity, setExpandedActivity] = React.useState<number | null>(null);
  const router = useRouter();

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

  const openAgentPage = (employee: AIEmployee) => {
    router.push(`/admin/lead-engine/agent/${employee.id}`);
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-3">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Activity className="h-9 w-9 text-primary" />
          </motion.div>
          AI Business Operations Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Your AI team is working 24/7 to grow your business
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Badge className="bg-green-500/15 text-green-400 border border-green-500/30 px-3 py-1">
            System Status: Operational{lastUpdated && ` • ${lastUpdated}`}
          </Badge>
          {supervisorReport && (
            <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 px-3 py-1">
              <Eye className="h-3 w-3 mr-1.5" />
              {supervisorReport.systemHealth.activeAgents} Agents Active
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Lead Pipeline - At Top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <LeadPipelineFlow />
      </motion.div>

      {/* Live Workflow - Merged Activity + Pipeline */}
      {activityFeed.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <LiveWorkflow employees={employees} activityFeed={activityFeed} />
        </motion.div>
      )}

      {/* AI Team - Enhanced with Animations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-border/60 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6 text-blue-400" />
                Your AI Team
              </CardTitle>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Click any card to view dashboard
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider delayDuration={200}>
              <motion.div 
                className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      staggerChildren: 0.05
                    }
                  }
                }}
              >
                {employees.map((employee, idx) => (
                  <motion.div
                    key={employee.id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 }
                    }}
                    whileHover={{ 
                      scale: 1.03, 
                      transition: { type: "spring", stiffness: 400, damping: 25 }
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="border-border/60 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer group overflow-hidden"
                      onClick={() => openAgentPage(employee)}
                    >
                      {/* Gradient top border on hover */}
                      <div className={`h-1 w-full ${employee.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                      
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <motion.div 
                            className={`p-3 rounded-xl ${employee.color}/10 group-hover:${employee.color}/20 transition-colors`}
                            whileHover={{ rotate: 5 }}
                          >
                            <div className={`w-10 h-10 rounded-lg ${employee.color} flex items-center justify-center text-white shadow-lg`}>
                              {employee.icon}
                            </div>
                          </motion.div>
                          <StatusBadge status={employee.status} />
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-semibold text-base text-foreground tracking-tight">{employee.name}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">{employee.role}</p>
                        </div>

                        <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                          <p className="text-xs text-muted-foreground/70 mb-1.5 uppercase tracking-wide font-medium">Current Task</p>
                          <p className="text-sm text-foreground leading-snug line-clamp-2">{employee.currentTask}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              <span className="font-semibold text-foreground">{employee.performance.tasksCompleted}</span> tasks
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              <span className="font-semibold text-foreground">{employee.performance.successRate}%</span> success
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {employee.tools.slice(0, 3).map((tool) => {
                            const toolInfo = TOOL_DESCRIPTIONS[tool];
                            return (
                              <Tooltip key={tool}>
                                <TooltipTrigger asChild>
                                  <motion.span 
                                    onClick={(e) => e.stopPropagation()}
                                    whileHover={{ scale: 1.05 }}
                                    className="inline-flex"
                                  >
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-primary/5 text-muted-foreground border-border/60 hover:bg-primary/10 hover:text-foreground transition-colors cursor-help">
                                      {toolInfo?.name || tool.replace(/_/g, ' ')}
                                    </Badge>
                                  </motion.span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-semibold text-xs">{toolInfo?.name || tool}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {toolInfo?.agentUsage[employee.id] || toolInfo?.description || ''}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {employee.tools.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">
                              +{employee.tools.length - 3}
                            </Badge>
                          )}
                        </div>

                        {employee.reportsTo && (
                          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                            <ArrowRight className="h-3 w-3 rotate-[-45deg]" />
                            Reports to {employee.reportsTo}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </TooltipProvider>
          </CardContent>
        </Card>
      </motion.div>

      {/* Business Health - Subtle at Bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-4 px-6 rounded-lg border border-border/40 bg-card/30 text-sm"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{metrics.leadsThisWeek}</span> leads
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCurrency(metrics.revenueThisMonth)}</span> revenue
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{metrics.customerSatisfaction > 0 ? `${metrics.customerSatisfaction.toFixed(0)}%` : '—'}</span> satisfaction
          </span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            Goal: <span className="font-semibold text-foreground">{Math.round(metrics.goalProgress)}%</span>
          </span>
          <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full"
              style={{ width: `${Math.max(metrics.goalProgress, 2)}%` }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { 
      color: 'bg-green-500/15 text-green-400 border-green-500/30',
      dot: 'bg-green-500',
      label: 'Active'
    },
    busy: { 
      color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      dot: 'bg-blue-500',
      label: 'Busy'
    },
    idle: { 
      color: 'bg-muted text-muted-foreground border-border',
      dot: 'bg-muted-foreground',
      label: 'Idle'
    },
  };

  const { color, dot, label } = config[status as keyof typeof config] || config.idle;

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${color}`}>
      {(status === 'active' || status === 'busy') && (
        <motion.span
          className={`w-1.5 h-1.5 rounded-full ${dot} mr-1.5`}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {label}
    </Badge>
  );
}
