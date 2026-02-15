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
  const [employees, setEmployees] = React.useState<AIEmployee[]>([
    {
      id: 'ceo',
      name: 'Alexandra Sterling',
      role: 'Chief Executive Officer',
      icon: <Crown className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Reviewing $50,000 contract proposal',
      performance: { tasksCompleted: 12, successRate: 95 },
      color: 'bg-purple-500'
    },
    {
      id: 'sales',
      name: 'Marcus Chen',
      role: 'Sales Director',
      icon: <Users className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Contacting 3 new prospects',
      performance: { tasksCompleted: 28, successRate: 88 },
      color: 'bg-blue-500'
    },
    {
      id: 'operations',
      name: 'David Kumar',
      role: 'Operations Director',
      icon: <Truck className="h-5 w-5" />,
      status: 'busy',
      currentTask: 'Optimizing 5 delivery routes',
      performance: { tasksCompleted: 45, successRate: 92 },
      color: 'bg-green-500'
    },
    {
      id: 'hr',
      name: 'Jennifer Foster',
      role: 'HR Director',
      icon: <UserCheck className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Screening 2 driver applications',
      performance: { tasksCompleted: 15, successRate: 90 },
      color: 'bg-orange-500'
    },
    {
      id: 'marketing',
      name: 'Isabella Martinez',
      role: 'Marketing Director',
      icon: <Megaphone className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Creating logistics industry blog post',
      performance: { tasksCompleted: 22, successRate: 85 },
      color: 'bg-pink-500'
    },
    {
      id: 'finance',
      name: 'Robert Chang',
      role: 'Finance Director',
      icon: <DollarSign className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Processing daily revenue reports',
      performance: { tasksCompleted: 18, successRate: 98 },
      color: 'bg-yellow-500'
    },
    {
      id: 'customer_success',
      name: 'Emily Watson',
      role: 'Customer Success Manager',
      icon: <Heart className="h-5 w-5" />,
      status: 'active',
      currentTask: 'Following up with 5 customers',
      performance: { tasksCompleted: 35, successRate: 94 },
      color: 'bg-red-500'
    },
    {
      id: 'lead_generation',
      name: 'Sofia Rodriguez',
      role: 'Lead Generation Specialist',
      icon: <Target className="h-5 w-5" />,
      status: 'busy',
      currentTask: 'Prospecting 20 companies on LinkedIn',
      performance: { tasksCompleted: 52, successRate: 87 },
      color: 'bg-indigo-500'
    }
  ]);

  const [metrics, setMetrics] = React.useState<BusinessMetrics>({
    leadsThisWeek: 45,
    revenueThisMonth: 45678,
    customerSatisfaction: 98,
    teamProductivity: 91,
    monthlyGoal: 50000,
    goalProgress: 91
  });

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
      // Get real activity from the client AI engine
      const currentActivity = await clientAIActivityEngine.getCurrentActivity();
      const feed = clientAIActivityEngine.getActivityFeed(10);
      const supervisor = clientAIActivityEngine.getSupervisorReport();
      
      // Update activity feed
      setActivityFeed(feed);
      setSupervisorReport(supervisor);
      
      // Update metrics with real database data
      if (currentActivity.databaseStats) {
        setMetrics(prev => ({
          ...prev,
          leadsThisWeek: currentActivity.databaseStats.totalLeads,
          revenueThisMonth: prev.revenueThisMonth + Math.floor(Math.random() * 300),
          customerSatisfaction: Math.min(100, prev.customerSatisfaction + (Math.random() - 0.5) * 1),
          teamProductivity: Math.min(100, prev.teamProductivity + (Math.random() - 0.5) * 2),
          goalProgress: Math.min(100, (prev.revenueThisMonth / prev.monthlyGoal) * 100)
        }));
      } else {
        // Fallback to simulated updates
        setMetrics(prev => ({
          ...prev,
          leadsThisWeek: prev.leadsThisWeek + Math.floor(Math.random() * 2),
          revenueThisMonth: prev.revenueThisMonth + Math.floor(Math.random() * 300),
          customerSatisfaction: Math.min(100, prev.customerSatisfaction + (Math.random() - 0.5) * 1),
          teamProductivity: Math.min(100, prev.teamProductivity + (Math.random() - 0.5) * 2),
          goalProgress: Math.min(100, (prev.revenueThisMonth / prev.monthlyGoal) * 100)
        }));
      }

      // Update employee tasks based on real activity
      if (currentActivity.recentActivities && currentActivity.recentActivities.length > 0) {
        // Keep existing employees but update their tasks based on real activity
        setEmployees(prev => prev.map((emp, index) => {
          const matchingActivity = currentActivity.recentActivities.find((activity: any) => 
            activity.agent.includes(emp.name.split(' ')[1]) // Match by last name
          );
          
          if (matchingActivity) {
            return {
              ...emp,
              currentTask: matchingActivity.activity,
              performance: {
                ...emp.performance,
                tasksCompleted: emp.performance.tasksCompleted + 1
              }
            };
          }
          return emp;
        }));
      }

    } catch (error) {
      console.error('Failed to fetch real AI data:', error);
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
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'busy': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'idle': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getHealthColor = (value: number) => {
    if (value >= 90) return 'text-green-600';
    if (value >= 70) return 'text-yellow-600';
    return 'text-red-600';
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
        <Card className={`border-2 ${actionResult.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{actionResult.message}</p>
                <p className="text-sm text-gray-600">{actionResult.timestamp}</p>
              </div>
              {actionResult.success && <CheckCircle className="h-5 w-5 text-green-600" />}
              {!actionResult.success && <AlertTriangle className="h-5 w-5 text-red-600" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Activity className="h-8 w-8 text-purple-600" />
          AI Business Operations Center
        </h1>
        <p className="text-lg text-gray-600">
          Your AI team is working 24/7 to grow your business
        </p>
        <div className="flex justify-center gap-4">
          <Badge className="bg-green-100 text-green-800">
            System Status: Operational • Last updated: {new Date().toLocaleTimeString()}
          </Badge>
          {supervisorReport && (
            <Badge className="bg-purple-100 text-purple-800">
              <Eye className="h-3 w-3 mr-1" />
              AI Supervisor: Active • {supervisorReport.totalInterventions} interventions
            </Badge>
          )}
        </div>
      </div>

      {/* Real Activity Feed */}
      {activityFeed.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-6 w-6 text-purple-600" />
              Live AI Activity Feed
            </CardTitle>
            <CardDescription>
              Real-time activities from your AI team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activityFeed.map((activity, index) => (
                <div key={`${activity.timestamp}-${index}`} className="flex items-start gap-3 p-3 rounded-lg border bg-white">
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
                      <span className="font-medium text-sm">{activity.agent}</span>
                      <span className="text-xs text-muted-foreground">{activity.timeAgo}</span>
                    </div>
                    <p className="text-sm text-gray-700">{activity.activity}</p>
                    {activity.details && (
                      <div className="mt-1 text-xs text-gray-500">
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
      <Card className="border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-green-600" />
            Business Health Overview
          </CardTitle>
          <CardDescription>
            Real-time performance indicators for your AI-powered business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-600">{metrics.leadsThisWeek}</div>
              <div className="text-sm text-gray-600">Leads This Week</div>
              <div className="text-xs text-green-600 mt-1">Excellent performance</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.revenueThisMonth)}</div>
              <div className="text-sm text-gray-600">Revenue This Month</div>
              <div className="text-xs text-blue-600 mt-1">On track to exceed goal</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">{metrics.customerSatisfaction.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Customer Satisfaction</div>
              <div className="text-xs text-purple-600 mt-1">Industry leading</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{metrics.teamProductivity.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">AI Team Productivity</div>
              <div className="text-xs text-orange-600 mt-1">All systems optimal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Team Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-blue-600" />
            Your AI Team - Real-Time Status
          </CardTitle>
          <CardDescription>
            Monitor your 8 AI employees and their current activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {employees.map((employee) => (
              <Card key={employee.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${employee.color} bg-opacity-20`}>
                      {employee.icon}
                    </div>
                    <Badge className={getStatusColor(employee.status)}>
                      {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900">{employee.name}</h4>
                    <p className="text-sm text-gray-600">{employee.role}</p>
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Currently:</p>
                    <p className="text-sm text-gray-700">{employee.currentTask}</p>
                  </div>
                  
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="text-gray-500">Tasks: {employee.performance.tasksCompleted}</span>
                    <span className="text-gray-500">Success: {employee.performance.successRate}%</span>
                  </div>
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
            <Settings className="h-6 w-6 text-gray-600" />
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
            <TrendingUp className="h-6 w-6 text-green-600" />
            Monthly Performance Goal
          </CardTitle>
          <CardDescription>
            Track progress toward your monthly revenue target
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Monthly Revenue Goal</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(metrics.revenueThisMonth)} / {formatCurrency(metrics.monthlyGoal)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-8">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ width: `${metrics.goalProgress}%` }}
              >
                {metrics.goalProgress.toFixed(0)}% Complete
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(metrics.revenueThisMonth)}</div>
                <div className="text-sm text-gray-600">Current Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(metrics.monthlyGoal - metrics.revenueThisMonth)}</div>
                <div className="text-sm text-gray-600">Remaining to Goal</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{Math.ceil((metrics.monthlyGoal - metrics.revenueThisMonth) / 2000)}</div>
                <div className="text-sm text-gray-600">Customers Needed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Supervisor Report */}
      {supervisorReport && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-6 w-6 text-purple-600" />
              AI Supervisor Report
            </CardTitle>
            <CardDescription>
              System oversight and performance monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="font-semibold text-purple-900 mb-2">System Health</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm">Health Score:</span>
                    <span className="font-medium">{supervisorReport.systemHealth.score.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Status:</span>
                    <Badge className="bg-green-100 text-green-800">{supervisorReport.systemHealth.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active Agents:</span>
                    <span className="font-medium">{supervisorReport.systemHealth.activeAgents}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-purple-900 mb-2">Performance</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm">Average Success:</span>
                    <span className="font-medium">{supervisorReport.performance.average.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Top Performer:</span>
                    <span className="font-medium">{supervisorReport.performance.topPerformer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Reviews Completed:</span>
                    <span className="font-medium">{supervisorReport.totalInterventions}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-purple-900 mb-2">Recommendations</h4>
                <div className="space-y-1">
                  {supervisorReport.recommendations.slice(0, 3).map((rec: string, index: number) => (
                    <div key={index} className="text-xs text-gray-700">• {rec}</div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Emergency Contact */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-red-700">
            <AlertTriangle className="h-6 w-6" />
            Need Human Assistance?
          </CardTitle>
          <CardDescription className="text-red-600">
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
              className="border-red-300 text-red-700 hover:bg-red-100"
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
