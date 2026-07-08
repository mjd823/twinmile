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
  Crown,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Loader2,
} from "lucide-react";

export interface StageCount {
  key: string;
  label: string;
  count: number;
}

export interface PipelineStats {
  driverStages: StageCount[];
  quoteStages: StageCount[];
  totalDriverLeads: number;
  totalQuoteLeads: number;
}

interface LeadEngineV2Props {
  quoteLeads: any[];
  driverLeads: any[];
  /** Full-collection, mutually exclusive stage counts computed server-side. */
  stats: PipelineStats | null;
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

const STAGE_STYLE: Record<string, { color: string; icon: React.ReactNode }> = {
  new: { color: "bg-slate-500", icon: <Users className="h-4 w-4" /> },
  contacted: { color: "bg-sky-500", icon: <ArrowRight className="h-4 w-4" /> },
  qualified: { color: "bg-blue-500", icon: <CheckCircle className="h-4 w-4" /> },
  onboarding: { color: "bg-indigo-500", icon: <Truck className="h-4 w-4" /> },
  negotiating: { color: "bg-amber-500", icon: <DollarSign className="h-4 w-4" /> },
  ready: { color: "bg-emerald-500", icon: <CheckCircle className="h-4 w-4" /> },
  converted: { color: "bg-green-500", icon: <TrendingUp className="h-4 w-4" /> },
  rejected: { color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
  lost: { color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function LeadEngineV2({ quoteLeads, driverLeads, stats }: LeadEngineV2Props) {
  const allLeads = [...quoteLeads, ...driverLeads];

  const totalDrivers = stats?.totalDriverLeads ?? driverLeads.length;
  const totalQuotes = stats?.totalQuoteLeads ?? quoteLeads.length;
  const totalLeads = totalDrivers + totalQuotes;

  // ===== COMPUTED KPIs (from the most recent leads loaded on this page) =====
  const qualifiedLeads = allLeads.filter(l => (l.score || 0) >= 75).length;
  const premiumLeads = allLeads.filter(l => l.quality === "premium").length;
  const convertedLeads = allLeads.filter(l => l.status === "converted").length;
  const pipelineValue = allLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const conversionRate = allLeads.length > 0 ? ((convertedLeads / allLeads.length) * 100).toFixed(1) : "0";

  const convertedWithDates = allLeads.filter(l => l.status === "converted" && l.createdAt && l.convertedAt);
  const avgSpeedToRevenue = convertedWithDates.length > 0
    ? Math.round(convertedWithDates.reduce((s, l) => {
        const created = new Date(l.createdAt).getTime();
        const converted = new Date(l.convertedAt).getTime();
        return s + (converted - created) / 86400000;
      }, 0) / convertedWithDates.length)
    : 0;

  const driverStages = stats?.driverStages ?? [];
  const quoteStages = stats?.quoteStages ?? [];

  // ===== RENDER =====
  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            Lead Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDrivers.toLocaleString()} driver prospects • {totalQuotes.toLocaleString()} quote leads • live pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">Live</Badge>
          <Link href="/admin/agents" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Zap className="h-4 w-4" />
            View All Agents
          </Link>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-6">
        {([
          { label: "Total Leads", value: totalLeads.toLocaleString(), icon: <Users className="h-5 w-5" />, color: "text-slate-600", href: "/admin/inbox" },
          { label: "Qualified (≥75)", value: qualifiedLeads, icon: <CheckCircle className="h-5 w-5" />, color: "text-blue-600", href: "/admin/inbox?stage=qualified" },
          { label: "Premium (85+)", value: premiumLeads, icon: <Crown className="h-5 w-5" />, color: "text-purple-600", href: "/admin/inbox" },
          { label: "Converted", value: convertedLeads, icon: <TrendingUp className="h-5 w-5" />, color: "text-green-600", change: `${conversionRate}%`, changeType: convertedLeads > 0 ? "up" : "neutral", href: "/admin/inbox?stage=converted" },
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

      {/* MAIN GRID: PIPELINE (2/3) + QUICK ACTIONS (1/3) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* PIPELINE FUNNELS */}
        <div className="lg:col-span-2 space-y-6">
          <PipelineCard
            title="Driver Pipeline"
            icon={<Truck className="h-5 w-5 text-orange-500" />}
            total={totalDrivers}
            stages={driverStages}
            type="drivers"
          />
          <PipelineCard
            title="Quote Pipeline"
            icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
            total={totalQuotes}
            stages={quoteStages}
            type="quotes"
          />
        </div>

        {/* QUICK ACTIONS PANEL */}
        <div className="space-y-4">
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
              <Link href="/admin/inbox?stage=new" className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Review New Leads</p>
                  <p className="text-xs text-muted-foreground">
                    {(driverStages.find(s => s.key === "new")?.count ?? 0) + (quoteStages.find(s => s.key === "new")?.count ?? 0)} awaiting review
                  </p>
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

/**
 * One pipeline funnel. Stages are mutually exclusive (each lead counted in
 * exactly one stage — the counts sum to the total) and each stage links to
 * the Leads list pre-filtered to that stage.
 */
function PipelineCard({
  title,
  icon,
  total,
  stages,
  type,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  stages: StageCount[];
  type: "drivers" | "quotes";
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {total.toLocaleString()} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-4">
          {stages.map((stage, i) => {
            const style = STAGE_STYLE[stage.key] || STAGE_STYLE.new;
            return (
              <React.Fragment key={stage.key}>
                <Link
                  href={`/admin/inbox?type=${type}&stage=${stage.key}`}
                  className="flex flex-col items-center min-w-[92px] flex-shrink-0 relative group cursor-pointer hover:scale-105 transition-transform"
                >
                  <div className={`w-14 h-14 rounded-xl ${style.color} flex items-center justify-center text-white shadow-lg relative z-10 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-primary/40`}>
                    {style.icon}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors tabular-nums">{stage.count.toLocaleString()}</div>
                    <div className="text-xs font-medium text-muted-foreground">{stage.label}</div>
                  </div>
                </Link>
                {i < stages.length - 1 && (
                  <div className="flex items-center h-14 w-6 text-slate-300">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Each lead is counted in exactly one stage. Click a stage to see those leads.
        </p>
      </CardContent>
    </Card>
  );
}

// Quick Action Button — actually triggers API calls, not just links
function QuickActionButton({ icon, color, title, subtitle, onClick }: { icon: React.ReactNode; color: string; title: string; subtitle: string; onClick: () => Promise<unknown> }) {
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
