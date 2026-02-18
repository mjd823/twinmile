import Link from "next/link";
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  ArrowUpRight, 
  Target,
  Truck,
  UserCheck,
  Crown
} from "lucide-react";

interface LeadEngineDashboardProps {
  quoteLeads: any[];
  driverLeads: any[];
}

interface TeamStats {
  name: string;
  icon: React.ReactNode;
  assignedLeads: number;
  avgQuality: number;
  totalValue: number;
  priorityCount: number;
  color: string;
}

export function LeadEngineDashboard({ quoteLeads, driverLeads }: LeadEngineDashboardProps) {
  // Leads arrive pre-scored from the server — no client-side Groq calls needed
  const allLeads = [...quoteLeads, ...driverLeads];
  const ownerLeads = allLeads.filter(lead => lead.routing?.assignee === 'owner');
  const recruitingLeads = allLeads.filter(lead => lead.routing?.assignee === 'recruiting_team');
  const freightLeads = allLeads.filter(lead => lead.routing?.assignee === 'freight_specialist' || lead.routing?.assignee === 'hotshot_team' || lead.routing?.assignee === 'general_sales');

  const teamStats: TeamStats[] = [
    {
      name: "CEO (Alexandra Sterling)",
      icon: <Crown className="h-5 w-5" />,
      assignedLeads: ownerLeads.length,
      avgQuality: ownerLeads.reduce((sum: number, lead: any) => sum + (lead.score || 0), 0) / (ownerLeads.length || 1),
      totalValue: ownerLeads.reduce((sum: number, lead: any) => sum + (lead.estimatedValue || 0), 0),
      priorityCount: ownerLeads.filter((lead: any) => lead.priority === 'urgent').length,
      color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    {
      name: "Recruiting (Jennifer Foster)",
      icon: <UserCheck className="h-5 w-5" />,
      assignedLeads: recruitingLeads.length,
      avgQuality: recruitingLeads.reduce((sum: number, lead: any) => sum + (lead.score || 0), 0) / (recruitingLeads.length || 1),
      totalValue: recruitingLeads.reduce((sum: number, lead: any) => sum + (lead.estimatedValue || 0), 0),
      priorityCount: recruitingLeads.filter((lead: any) => lead.priority === 'urgent').length,
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      name: "Freight (Marcus Chen)",
      icon: <Truck className="h-5 w-5" />,
      assignedLeads: freightLeads.length,
      avgQuality: freightLeads.reduce((sum: number, lead: any) => sum + (lead.score || 0), 0) / (freightLeads.length || 1),
      totalValue: freightLeads.reduce((sum: number, lead: any) => sum + (lead.estimatedValue || 0), 0),
      priorityCount: freightLeads.filter((lead: any) => lead.priority === 'urgent').length,
      color: "bg-green-500/20 text-green-400 border-green-500/30",
    },
  ];

  const premiumCount = allLeads.filter((l: any) => l.quality === 'premium').length;
  const totalValue = allLeads.reduce((sum: number, l: any) => sum + (l.estimatedValue || 0), 0);

  const processingStats = {
    totalLeads: allLeads.length,
    autoQualified: allLeads.length,
    premiumLeads: premiumCount,
    totalValue,
    automationRate: 100,
  };

  function getQualityColor(quality: string) {
    switch (quality) {
      case "premium": return "bg-purple-500/20 text-purple-700 border-purple-500/30";
      case "high": return "bg-green-500/20 text-green-700 border-green-500/30";
      case "medium": return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case "low": return "bg-gray-500/20 text-gray-700 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case "urgent": return "bg-red-500/20 text-red-700 border-red-500/30";
      case "high": return "bg-orange-500/20 text-orange-700 border-orange-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30";
      case "low": return "bg-gray-500/20 text-gray-700 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    }
  }

  return (
    <div className="space-y-6">
      {/* Processing Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingStats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">Real-time processing</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto-Qualified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{processingStats.autoQualified}</div>
            <p className="text-xs text-muted-foreground">{processingStats.automationRate}% automation rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Premium Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{processingStats.premiumLeads}</div>
            <p className="text-xs text-muted-foreground">Auto-escalated</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${processingStats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Estimated revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Automation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{processingStats.automationRate}%</div>
            <p className="text-xs text-muted-foreground">Fully automated</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Lead Assignment
          </CardTitle>
          <CardDescription>
            Real-time lead distribution and team performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {teamStats.map((team, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${team.color.replace('bg-', 'bg-').split('/')[0]}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {team.icon}
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                    </div>
                    <Badge className={team.color}>
                      {team.assignedLeads} leads
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Avg Quality:</span>
                      <div className="text-lg font-semibold">{Math.round(team.avgQuality)}/100</div>
                    </div>
                    <div>
                      <span className="font-medium">Pipeline:</span>
                      <div className="text-lg font-semibold text-green-600">${team.totalValue.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {team.priorityCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Urgent:</span>
                      <Badge className="bg-red-500/20 text-red-700 border-red-500/30">
                        {team.priorityCount} priority leads
                      </Badge>
                    </div>
                  )}

                  <div className="pt-2">
                    <Link
                      href={index === 0 ? "/admin/dashboard/owner" : index === 1 ? "/admin/dashboard/recruiting" : "/admin/dashboard/freight"}
                      className="w-full inline-flex items-center justify-center rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm font-medium hover:bg-background/80 transition-colors"
                    >
                      Manage Team Dashboard →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>


      {/* Automation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Active Automation Rules
          </CardTitle>
          <CardDescription>
            Intelligent lead processing rules running 24/7
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-semibold">🎯 Lead Scoring Algorithm</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Business clients: +10 points</li>
                <li>• Complete routes: +15 points</li>
                <li>• Owner operators: +15 points</li>
                <li>• 5+ years experience: +20 points</li>
                <li>• Freight services: +20 points</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">🚀 Smart Routing Logic</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Premium leads (85+) → Owner notification</li>
                <li>• Driver leads → Recruiting team</li>
                <li>• Freight leads → Freight specialists</li>
                <li>• Low quality → Automated response only</li>
                <li>• Urgent leads → Immediate escalation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
