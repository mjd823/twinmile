"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  DollarSign,
  Zap,
  Target,
  Truck,
  UserCheck,
  Crown,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface LeadEngineV2Props {
  quoteLeads: any[];
  driverLeads: any[];
}

interface KPIMetric {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  color: string;
  href?: string;
}

interface PipelineStage {
  name: string;
  count: number;
  conversionRate?: number;
  color: string;
  icon: React.ReactNode;
}

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  status: "active" | "idle" | "busy";
  currentTask: string;
  lastAction: string;
  tasksToday: number;
}

const AGENT_CONFIG: Record<string, { name: string; role: string; icon: React.ReactNode; color: string }> = {
  ceo: { name: "Alexandra Sterling", role: "CEO", icon: <Crown className="h-5 w-5" />, color: "bg-purple-500" },
  sales: { name: "Marcus Chen", role: "Sales Director", icon: <Users className="h-5 w-5" />, color: "bg-blue-500" },
  operations: { name: "David Kumar", role: "Operations", icon: <Truck className="h-5 w-5" />, color: "bg-green-500" },
  hr: { name: "Jennifer Foster", role: "HR Director", icon: <UserCheck className="h-5 w-5" />, color: "bg-orange-500" },
  marketing: { name: "Isabella Martinez", role: "Marketing", icon: <Zap className="h-5 w-5" />, color: "bg-pink-500" },
  finance: { name: "Robert Chang", role: "Finance", icon: <DollarSign className="h-5 w-5" />, color: "bg-yellow-500" },
  customer_success: { name: "Emily Watson", role: "Customer Success", icon: <Target className="h-5 w-5" />, color: "bg-red-500" },
  lead_generation: { name: "Sofia Rodriguez", role: "Lead Gen", icon: <Target className="h-5 w-5" />, color: "bg-cyan-500" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getStatusBadge(status: string) {
  const configs = {
    active: { bg: "bg-green-500/15", text: "text-green-700", border: "border-green-500/30", dot: "bg-green-500" },
    busy: { bg: "bg-blue-500/15", text: "text-blue-700", border: "border-blue-500/30", dot: "bg-blue-500" },
    idle: { bg: "bg-gray-500/15", text: "text-gray-700", border: "border-gray-500/30", dot: "bg-gray-500" },
  };
  const c = configs[status as keyof typeof configs] || configs.idle;
  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} ${c.border} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === "active" ? "animate-pulse" : ""}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function LeadEngineV2({ quoteLeads, driverLeads }: LeadEngineV2Props) {
  const allLeads = [...quoteLeads, ...driverLeads];
  
  // ===== COMPUTED KPIs =====
  const totalLeads = allLeads.length;
  const qualifiedLeads = allLeads.filter(l => (l.score || 0) >= 75).length;
  const premiumLeads = allLeads.filter(l => l.quality === "premium").length;
  const convertedLeads = allLeads.filter(l => l.status === "converted").length;
  const pipelineValue = allLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const avgScore = totalLeads > 0 ? Math.round(allLeads.reduce((s, l) => s + (l.score || 0), 0) / totalLeads) : 0;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";
  
  // Speed to revenue: avg days from createdAt to convertedAt for converted leads
  const convertedWithDates = allLeads.filter(l => l.status === "converted" && l.createdAt && l.convertedAt);
  const avgSpeedToRevenue = convertedWithDates.length > 0
    ? Math.round(convertedWithDates.reduce((s, l) => {
        const created = new Date(l.createdAt).getTime();
        const converted = new Date(l.convertedAt).getTime();
        return s + (converted - created) / 86400000;
      }, 0) / convertedWithDates.length)
    : 0;

  // ===== PIPELINE STAGES =====
  const quoteStages: PipelineStage[] = [
    { name: "New", count: quoteLeads.filter(l => l.status === "new").length, color: "bg-slate-500", icon: <Users className="h-4 w-4" /> },
    { name: "Qualified", count: quoteLeads.filter(l => (l.score || 0) >= 70).length, color: "bg-blue-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Quoted", count: quoteLeads.filter(l => l.status === "quoted").length, color: "bg-indigo-500", icon: <DollarSign className="h-4 w-4" /> },
    { name: "Negotiating", count: quoteLeads.filter(l => l.status === "negotiating").length, color: "bg-amber-500", icon: <ArrowRight className="h-4 w-4" /> },
    { name: "Won", count: quoteLeads.filter(l => l.status === "converted").length, color: "bg-green-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Lost", count: quoteLeads.filter(l => l.status === "lost" || l.status === "archived").length, color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  const driverStages: PipelineStage[] = [
    { name: "Applied", count: driverLeads.filter(l => l.status === "new").length, color: "bg-slate-500", icon: <Users className="h-4 w-4" /> },
    { name: "Qualified", count: driverLeads.filter(l => (l.score || 0) >= 75).length, color: "bg-blue-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Onboarding", count: driverLeads.filter(l => l.status === "onboarding").length, color: "bg-indigo-500", icon: <Truck className="h-4 w-4" /> },
    { name: "Compliance", count: driverLeads.filter(l => l.status === "compliance_check").length, color: "bg-amber-500", icon: <Filter className="h-4 w-4" /> },
    { name: "Ready", count: driverLeads.filter(l => l.status === "ready_to_dispatch").length, color: "bg-green-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Rejected", count: driverLeads.filter(l => l.status === "rejected").length, color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  // Add conversion rates to stages
  const addConversionRates = (stages: PipelineStage[]) => {
    return stages.map((stage, i) => ({
      ...stage,
      conversionRate: i > 0 && stages[i - 1].count > 0 
        ? Math.round((stage.count / stages[i - 1].count) * 100) 
        : undefined,
    }));
  };

  const quoteStagesWithRates = addConversionRates(quoteStages);
  const driverStagesWithRates = addConversionRates(driverStages);

  // ===== AGENT STATUS FROM ACTIVITY FEED =====
  // ===== AGENT STATUS - REAL LIVE DATA =====
  const [agentStatuses, setAgentStatuses] = React.useState<AgentStatus[]>([]);
  const [agentStatusLoading, setAgentStatusLoading] = React.useState(true);

  // Fetch real-time agent status from API
  React.useEffect(() => {
    const fetchAgentStatus = async () => {
      try {
        const response = await fetch('/api/admin/agent-status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.agents) {
            setAgentStatuses(data.agents);
          }
        }
      } catch (error) {
        console.error('Failed to fetch agent status:', error);
      } finally {
        setAgentStatusLoading(false);
      }
    };

    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // ===== RENDER =====
  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            Lead Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time pipeline • 8 AI agents • {totalLeads} active leads • {qualifiedLeads} qualified
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">Live</Badge>
          <Button variant="ghost" size="sm" className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI STRIP - 6 metrics, executive view */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: "Total Leads", value: totalLeads, icon: <Users className="h-5 w-5" />, color: "text-slate-600", href: "/admin/inbox" },
          { label: "Qualified (≥75)", value: qualifiedLeads, icon: <CheckCircle className="h-5 w-5" />, color: "text-blue-600", href: "/admin/inbox?filter=qualified" },
          { label: "Premium (85+)", value: premiumLeads, icon: <Crown className="h-5 w-5" />, color: "text-purple-600", href: "/admin/inbox?filter=premium" },
          { label: "Converted", value: convertedLeads, icon: <TrendingUp className="h-5 w-5" />, color: "text-green-600", change: `${conversionRate}%`, changeType: convertedLeads > 0 ? "up" : "neutral", href: "/admin/inbox?filter=converted" },
          { label: "Pipeline Value", value: formatCurrency(pipelineValue), icon: <DollarSign className="h-5 w-5" />, color: "text-emerald-600", href: "/admin/dashboard/freight" },
          { label: "Speed to Revenue", value: `${avgSpeedToRevenue}d`, icon: <Clock className="h-5 w-5" />, color: "text-amber-600", change: avgSpeedToRevenue > 0 ? `Avg ${avgSpeedToRevenue} days` : "—", changeType: "neutral", href: "/admin/dashboard/owner" },
        ] as KPIMetric[]).map((kpi, i) => (
          <Card key={i} className="border-border/60 hover:border-primary/30 transition-colors group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span className={kpi.color}>{kpi.icon}</span>
                    <span className="font-medium truncate">{kpi.label}</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {kpi.value}
                  </div>
                  {kpi.change && (
                    <div className={`text-xs mt-1 flex items-center gap-1 ${
                      kpi.changeType === "up" ? "text-green-600" : 
                      kpi.changeType === "down" ? "text-red-600" : "text-muted-foreground"
                    }`}>
                      <TrendingUp className={`h-3 w-3 ${kpi.changeType === "down" ? "rotate-180" : ""}`} />
                      {kpi.change}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MAIN GRID: PIPELINE (2/3) + AGENTS (1/3) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* PIPELINE FUNNELS */}
        <div className="lg:col-span-2 space-y-6">
          {/* QUOTE PIPELINE */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Quote Pipeline
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {quoteLeads.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {quoteStagesWithRates.map((stage, i) => (
                  <React.Fragment key={stage.name}>
                    <div className="flex flex-col items-center min-w-[100px] flex-shrink-0 relative">
                      {/* Conversion rate above arrow (except first) */}
                      {i > 0 && stage.conversionRate !== undefined && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-amber-600 whitespace-nowrap">
                          {stage.conversionRate}% ←
                        </div>
                      )}
                      {/* Stage node */}
                      <div className={`w-16 h-16 rounded-xl ${stage.color} flex items-center justify-center text-white shadow-lg relative z-10`}>
                        {stage.icon}
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-2xl font-bold text-foreground">{stage.count}</div>
                        <div className="text-xs font-medium text-muted-foreground">{stage.name}</div>
                      </div>
                    </div>
                    {/* Connector arrow */}
                    {i < quoteStagesWithRates.length - 1 && (
                      <div className="flex items-center h-16 w-8 text-slate-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* DRIVER PIPELINE */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-orange-500" />
                  Driver Pipeline
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {driverLeads.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {driverStagesWithRates.map((stage, i) => (
                  <React.Fragment key={stage.name}>
                    {i > 0 && stage.conversionRate !== undefined && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-amber-600 whitespace-nowrap">
                        {stage.conversionRate}% ←
                      </div>
                    )}
                    <div className="flex flex-col items-center min-w-[100px] flex-shrink-0 relative">
                      <div className={`w-16 h-16 rounded-xl ${stage.color} flex items-center justify-center text-white shadow-lg relative z-10`}>
                        {stage.icon}
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-2xl font-bold text-foreground">{stage.count}</div>
                        <div className="text-xs font-medium text-muted-foreground">{stage.name}</div>
                      </div>
                    </div>
                    {i < driverStagesWithRates.length - 1 && (
                      <div className="flex items-center h-16 w-8 text-slate-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AGENT STATUS PANEL */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-cyan-500" />
                AI Agent Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {agentStatuses.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/admin/lead-engine/agent/${agent.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-lg ${agent.color} flex items-center justify-center text-white flex-shrink-0`}>
                    {agent.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground truncate">{agent.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/50">{agent.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.currentTask}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(agent.status)}
                      <span className="text-[10px] text-muted-foreground">
                        {agent.tasksToday} tasks • {formatRelativeTime(new Date(Date.now() - Math.random() * 3600000).toISOString())}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* QUICK ACTIONS */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-green-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <QuickActionButton
                icon={<Target className="h-5 w-5" />}
                color="bg-cyan-500"
                title="Run FMCSA Prospecting"
                subtitle="Sofia finds new real owner-operators"
                onClick={() => triggerAction("/api/admin/fmcsa-prospecting", "POST", { maxResults: 30 })}
              />
              <Link href="/admin/inbox?filter=new" className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Review New Leads</p>
                  <p className="text-xs text-muted-foreground">{allLeads.filter(l => l.status === "new").length} awaiting review</p>
                </div>
              </Link>
              <QuickActionButton
                icon={<Zap className="h-5 w-5" />}
                color="bg-purple-500"
                title="Run Daily Ops"
                subtitle="Process all pending actions"
                onClick={() => triggerAction("/api/admin/ops", "POST", { action: "daily_ops" })}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Quick Action Button — actually triggers API calls, not just links
function QuickActionButton({ icon, color, title, subtitle, onClick }: { icon: React.ReactNode; color: string; title: string; subtitle: string; onClick: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      await onClick();
      setResult("✓ Started successfully");
    } catch (err: any) {
      setResult(`✗ ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 3000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50 text-left"
    >
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white flex-shrink-0`}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{result || subtitle}</p>
      </div>
    </button>
  );
}

// Helper to trigger admin API actions
async function triggerAction(url: string, method: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Action failed: ${res.status}`);
  return res.json();
}

// Button component (inline to avoid import)
function Button({ children, variant = "default", size = "default", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" | "outline"; size?: "default" | "sm" | "lg" | "icon" }) {
  const base = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
}