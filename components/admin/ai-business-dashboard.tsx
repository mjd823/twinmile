"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  TrendingUp,
  Activity,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  Pause,
  Settings,
  Brain,
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

  const [lastAction, setLastAction] = React.useState<string>('');
  const [actionResult, setActionResult] = React.useState<any>(null);
  const [activityFeed, setActivityFeed] = React.useState<any[]>([]);
  const [supervisorReport, setSupervisorReport] = React.useState<any>(null);

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

  // Handle actions on client side
  const handleAction = async (action: string) => {
    setLastAction(action);
    
    try {
      // Call the client AI activity engine
      const result = await clientAIActivityEngine.handleDashboardAction(action);
      
      // Show immediate feedback
      setActionResult({
        action,
        success: result.success,
        message: result.message,
        timestamp: result.timestamp,
        details: result.details
      });

      // Refresh data after action
      setTimeout(fetchRealAIData, 2000);

    } catch (error) {
      setActionResult({
        action,
        success: false,
        message: `❌ Failed to execute ${action}`,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    // Clear result after 5 seconds
    setTimeout(() => setActionResult(null), 5000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'busy': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'idle': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getHealthColor = (value: number) => {
    if (value >= 90) return 'text-green-400';
    if (value >= 70) return 'text-yellow-400';
    return 'text-red-400';
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
      {/* Action Result Notification */}
      {actionResult && (
        <Card className={`border-2 ${actionResult.success ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{actionResult.message}</p>
                <p className="text-sm text-muted-foreground">{actionResult.timestamp}</p>
              </div>
              {actionResult.success && <CheckCircle className="h-5 w-5 text-green-400" />}
              {!actionResult.success && <AlertTriangle className="h-5 w-5 text-red-400" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          AI Business Operations Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Your AI team is working 24/7 to grow your business
        </p>
        <div className="flex justify-center gap-4">
          <Badge className="bg-green-500/15 text-green-400 border border-green-500/30">
            System Status: Operational{lastUpdated && ` • Last updated: ${lastUpdated}`}
          </Badge>
          {supervisorReport && (
            <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Eye className="h-3 w-3 mr-1" />
              AI Supervisor: Active • {supervisorReport.totalInterventions} interventions
            </Badge>
          )}
        </div>
      </div>

      {/* Real Activity Feed */}
      {activityFeed.length > 0 && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-6 w-6 text-purple-400" />
              Live AI Activity Feed
            </CardTitle>
            <CardDescription>
              Real-time activities from your AI team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activityFeed.map((activity, index) => (
                <div key={`${activity.timestamp}-${index}`} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'supervision' ? 'bg-purple-500' :
                    activity.type === 'lead_processing' ? 'bg-blue-500' :
                    activity.type === 'prospecting' ? 'bg-green-500' :
                    activity.type === 'marketing' ? 'bg-pink-500' :
                    activity.type === 'operations' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground">{activity.agent}</span>
                      <span className="text-xs text-muted-foreground">{activity.timeAgo}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.activity}</p>
                    {activity.details && (
                      <div className="mt-1 text-xs text-muted-foreground/70">
                        {Object.entries(activity.details).slice(0, 2).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Health Overview */}
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-green-400" />
            Business Health Overview
          </CardTitle>
          <CardDescription>
            Real-time performance indicators for your AI-powered business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{metrics.leadsThisWeek}</div>
              <div className="text-sm text-muted-foreground">Leads This Week</div>
              <div className="text-xs text-green-400/70 mt-1">From database</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(metrics.revenueThisMonth)}</div>
              <div className="text-sm text-muted-foreground">Revenue This Month</div>
              <div className="text-xs text-blue-400/70 mt-1">From loads collection</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="text-2xl font-bold text-purple-400">{metrics.customerSatisfaction.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Customer Satisfaction</div>
              <div className="text-xs text-purple-400/70 mt-1">{metrics.customerSatisfaction > 0 ? 'Active customers' : 'No customers yet'}</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="text-2xl font-bold text-orange-400">{metrics.teamProductivity.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">AI Team Productivity</div>
              <div className="text-xs text-orange-400/70 mt-1">{metrics.teamProductivity > 0 ? 'Processing leads' : 'Waiting for leads'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Team Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-blue-400" />
            Your AI Team - Real-Time Status
          </CardTitle>
          <CardDescription>
            Monitor your 8 AI employees and their current activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {employees.map((employee) => (
              <Card key={employee.id} className="border-border/60 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${employee.color}/15`}>
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
                    <p className="text-sm text-muted-foreground">{employee.currentTask}</p>
                  </div>
                  
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="text-muted-foreground">Tasks: {employee.performance.tasksCompleted}</span>
                    <span className="text-muted-foreground">Success: {employee.performance.successRate}%</span>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-1">
                    {employee.tools.map((tool) => (
                      <Badge key={tool} variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 text-muted-foreground border-border/60">
                        {tool.replace(/_/g, ' ')}
                      </Badge>
                    ))}
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
        </CardContent>
      </Card>

      {/* Business Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-6 w-6 text-muted-foreground" />
            Business Controls
          </CardTitle>
          <CardDescription>
            One-click actions to direct your AI team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button 
              onClick={() => handleAction('find_customers')}
              className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Target className="h-6 w-6" />
              <span>Find New Customers</span>
              <span className="text-xs opacity-90">Activate lead generation</span>
            </Button>
            
            <Button 
              onClick={() => handleAction('send_marketing')}
              className="h-20 flex-col gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Megaphone className="h-6 w-6" />
              <span>Launch Marketing</span>
              <span className="text-xs opacity-90">Start campaign</span>
            </Button>
            
            <Button 
              onClick={() => handleAction('check_revenue')}
              className="h-20 flex-col gap-2 bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="h-6 w-6" />
              <span>View Revenue</span>
              <span className="text-xs opacity-90">Financial summary</span>
            </Button>
            
            <Button 
              onClick={() => handleAction('hire_drivers')}
              className="h-20 flex-col gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <UserCheck className="h-6 w-6" />
              <span>Hire Drivers</span>
              <span className="text-xs opacity-90">Recruitment process</span>
            </Button>
            
            <Button 
              onClick={() => handleAction('schedule_deliveries')}
              className="h-20 flex-col gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Truck className="h-6 w-6" />
              <span>Schedule Deliveries</span>
              <span className="text-xs opacity-90">Route optimization</span>
            </Button>
            
            <Button 
              onClick={() => handleAction('customer_support')}
              className="h-20 flex-col gap-2 bg-red-600 hover:bg-red-700"
            >
              <Heart className="h-6 w-6" />
              <span>Customer Support</span>
              <span className="text-xs opacity-90">Service management</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Goal Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-green-400" />
            Monthly Performance Goal
          </CardTitle>
          <CardDescription>
            Track progress toward your monthly revenue target
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-foreground">Monthly Revenue Goal</span>
              <span className="text-lg font-bold text-green-400">
                {formatCurrency(metrics.revenueThisMonth)} / {formatCurrency(metrics.monthlyGoal)}
              </span>
            </div>
            
            <div className="w-full bg-secondary rounded-full h-8">
              <div 
                className="bg-gradient-to-r from-green-600 to-green-500 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ width: `${Math.max(metrics.goalProgress, 2)}%` }}
              >
                {metrics.goalProgress.toFixed(0)}%
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">{formatCurrency(metrics.revenueThisMonth)}</div>
                <div className="text-sm text-muted-foreground">Current Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400">{formatCurrency(metrics.monthlyGoal - metrics.revenueThisMonth)}</div>
                <div className="text-sm text-muted-foreground">Remaining to Goal</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{Math.ceil((metrics.monthlyGoal - metrics.revenueThisMonth) / 2000)}</div>
                <div className="text-sm text-muted-foreground">Customers Needed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Supervisor Report */}
      {supervisorReport && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-6 w-6 text-purple-400" />
              AI Supervisor Report
            </CardTitle>
            <CardDescription>
              System oversight and performance monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">System Health</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Health Score:</span>
                    <span className="font-medium text-foreground">{supervisorReport.systemHealth.score.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className="bg-green-500/15 text-green-400">{supervisorReport.systemHealth.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Agents:</span>
                    <span className="font-medium text-foreground">{supervisorReport.systemHealth.activeAgents}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">Performance</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average Success:</span>
                    <span className="font-medium text-foreground">{supervisorReport.performance.average.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Top Performer:</span>
                    <span className="font-medium text-foreground">{supervisorReport.performance.topPerformer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Reviews Completed:</span>
                    <span className="font-medium text-foreground">{supervisorReport.totalInterventions}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">Recommendations</h4>
                <div className="space-y-1">
                  {supervisorReport.recommendations.slice(0, 3).map((rec: string, index: number) => (
                    <div key={index} className="text-xs text-muted-foreground">• {rec}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emergency Contact */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-red-400">
            <AlertTriangle className="h-6 w-6" />
            Need Human Assistance?
          </CardTitle>
          <CardDescription className="text-red-400/70">
            If you encounter any issues or need immediate help
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={() => handleAction('emergency_call')}
              className="bg-red-600 hover:bg-red-700"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Support
            </Button>
            <Button 
              onClick={() => handleAction('emergency_email')}
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
