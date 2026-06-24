"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, CheckCircle2, Mail, UserCheck, FileText,
  Signature, Truck, ChevronDown, ChevronRight, RefreshCw,
  TrendingUp, Users, Zap, ExternalLink, XCircle,
} from "lucide-react";

interface FunnelData {
  totalProspects: number;
  qualified: number;
  onboardingInvited: number;
  onboardingStarted: number;
  documentsSubmitted: number;
  leaseSigned: number;
  dispatchReady: number;
}

interface Prospect {
  id: string;
  name: string;
  dotNumber: string;
  location: string;
  state: string;
  aiScore: number;
  status: string;
  source: string;
  phone: string;
  email: string;
  equipment: string;
  powerUnits: number;
  drivers: number;
  safetyRating: string;
  authorityStatus: string;
  interestSignals: string[];
  sourceUrl: string;
  createdAt: string;
}

interface OnboardingSession {
  id: string;
  leadName: string;
  leadEmail: string;
  leadType: string;
  status: string;
  aiScore: number;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  preFilledData: any;
  onboardingUrl: string;
}

interface ActivityItem {
  id: string;
  action: string;
  agent: string;
  agentRole: string;
  result: any;
  success: boolean;
  timestamp: string;
}

interface AgentStat {
  name: string;
  activityCount: number;
  lastActivity: string;
  isActive: boolean;
}

const ALL_AGENTS = [
  { name: "Sofia Rodriguez", role: "Lead Generation", dept: "Sales", icon: "🔍", color: "cyan" },
  { name: "Marcus Chen", role: "Sales Director", dept: "Sales", icon: "💼", color: "blue" },
  { name: "Alexandra Sterling", role: "CEO", dept: "Executive", icon: "👑", color: "purple" },
  { name: "David Kumar", role: "Operations", dept: "Operations", icon: "🚛", color: "green" },
  { name: "Jennifer Foster", role: "HR Director", dept: "HR", icon: "👤", color: "amber" },
  { name: "Isabella Martinez", role: "Marketing", dept: "Marketing", icon: "📢", color: "pink" },
  { name: "Robert Chang", role: "Finance", dept: "Finance", icon: "💰", color: "indigo" },
  { name: "Emily Watson", role: "Customer Success", dept: "CS", icon: "❤️", color: "rose" },
];

const STAGES = [
  { key: "totalProspects", label: "Prospects Found", icon: Search, color: "blue", description: "Real carriers from FMCSA" },
  { key: "qualified", label: "Qualified (≥75)", icon: CheckCircle2, color: "green", description: "AI scored and qualified" },
  { key: "onboardingInvited", label: "Onboarding Invited", icon: Mail, color: "cyan", description: "Email sent with token link" },
  { key: "onboardingStarted", label: "Onboarding Started", icon: UserCheck, color: "purple", description: "Prospect clicked link" },
  { key: "documentsSubmitted", label: "Documents Submitted", icon: FileText, color: "amber", description: "CDL, COI, W-9, etc." },
  { key: "leaseSigned", label: "Lease Signed", icon: Signature, color: "indigo", description: "E-signature complete" },
  { key: "dispatchReady", label: "Dispatch Ready", icon: Truck, color: "emerald", description: "Approved and ready" },
];

export function PipelineFlowDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [prospects, setProspects] = React.useState<Prospect[]>([]);
  const [sessions, setSessions] = React.useState<OnboardingSession[]>([]);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [agentStats, setAgentStats] = React.useState<AgentStat[]>([]);
  const [expandedProspect, setExpandedProspect] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<"prospects" | "onboarding" | "activity">("prospects");
  const [filterStage, setFilterStage] = React.useState<string>("all");
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/pipeline-funnel");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setFunnel(data.data?.funnel);
      setProspects(data.data?.recentProspects || []);
      setSessions(data.data?.onboardingSessions || []);
      setActivity(data.data?.activityFeed || []);
      setAgentStats(data.data?.agentStats || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredProspects = prospects.filter(p => {
    if (filterStage === "all") return true;
    if (filterStage === "qualified") return p.aiScore >= 75;
    return p.status === filterStage;
  });

  const conversionRate = funnel && funnel.totalProspects > 0
    ? ((funnel.onboardingInvited / funnel.totalProspects) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Pipeline Flow Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of owner-operator pipeline from prospect to dispatch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated: {lastRefresh.toLocaleTimeString("en-US")}
          </span>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Conversion Summary */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent pt-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Overall Conversion Rate</p>
              <p className="text-3xl font-bold text-primary mt-1">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {funnel?.onboardingInvited || 0} invited / {funnel?.totalProspects || 0} prospects
              </p>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <MiniStat label="Total Prospects" value={funnel?.totalProspects || 0} icon={<Search className="h-4 w-4 text-blue-500" />} onClick={() => { setActiveSection("prospects"); setFilterStage("all"); }} />
              <MiniStat label="Qualified" value={funnel?.qualified || 0} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} onClick={() => { setActiveSection("prospects"); setFilterStage("qualified"); }} />
              <MiniStat label="Onboarding" value={funnel?.onboardingStarted || 0} icon={<UserCheck className="h-4 w-4 text-purple-500" />} onClick={() => setActiveSection("onboarding")} />
              <MiniStat label="Dispatch Ready" value={funnel?.dispatchReady || 0} icon={<Truck className="h-4 w-4 text-emerald-500" />} onClick={() => setActiveSection("onboarding")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Funnel Visualization */}
      <div className="space-y-2">
        {STAGES.map((stage, i) => {
          const value = funnel?.[stage.key as keyof FunnelData] || 0;
          const maxValue = funnel?.totalProspects || 1;
          const width = value > 0 ? Math.max(8, (value / maxValue) * 100) : 0;
          const StageIcon = stage.icon;

          // Map stage to tab + filter
          const stageClick = () => {
            if (stage.key === "totalProspects") { setActiveSection("prospects"); setFilterStage("all"); }
            else if (stage.key === "qualified") { setActiveSection("prospects"); setFilterStage("qualified"); }
            else if (stage.key === "onboardingInvited" || stage.key === "onboardingStarted") { setActiveSection("onboarding"); }
            else if (stage.key === "documentsSubmitted" || stage.key === "leaseSigned" || stage.key === "dispatchReady") { setActiveSection("onboarding"); }
            else { setActiveSection("prospects"); }
          };

          return (
            <Card key={stage.key} className="border-border/60">
              <CardContent className="p-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={stageClick}>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-${stage.color}-500/10 text-${stage.color}-500 flex-shrink-0`}>
                    <StageIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-medium">{stage.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{stage.description}</span>
                      </div>
                      <span className="text-lg font-bold">{value}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full bg-${stage.color}-500 rounded-full transition-all duration-500`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Agent Overview — All 8 Agents Working */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            AI Agent Team Overview ({agentStats.filter(a => a.isActive).length} active)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ALL_AGENTS.map((agent) => {
              const stat = agentStats.find(s => s.name === agent.name);
              const isActive = stat?.isActive || false;
              const count = stat?.activityCount || 0;
              const lastActivity = stat?.lastActivity;

              return (
                <div
                  key={agent.name}
                  className={`rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer hover:scale-[1.02] ${
                    isActive
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border/60 bg-muted/20"
                  }`}
                  onClick={() => window.open('/admin/agents', '_self')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{agent.icon}</span>
                    <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                  </div>
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <Badge variant={isActive ? "default" : "secondary"} className="text-[9px]">
                      {isActive ? "Active" : "Idle"}
                    </Badge>
                    <span className="text-muted-foreground">{count} tasks</span>
                  </div>
                  {lastActivity && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Last: {new Date(lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Section: Prospects | Onboarding | Activity */}
      <div>
        <div className="flex gap-1 border-b border-border/60 mb-4">
          <button
            onClick={() => setActiveSection("prospects")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === "prospects" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            All Prospects ({prospects.length})
          </button>
          <button
            onClick={() => setActiveSection("onboarding")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === "onboarding" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <UserCheck className="h-4 w-4 inline mr-1" />
            Onboarding ({sessions.length})
          </button>
          <button
            onClick={() => setActiveSection("activity")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === "activity" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Zap className="h-4 w-4 inline mr-1" />
            Live Activity ({activity.length})
          </button>
        </div>

      {/* Prospects Tab */}
      {activeSection === "prospects" && (
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              All Prospects ({prospects.length})
            </CardTitle>
            <div className="flex gap-1 flex-wrap">
              <FilterButton active={filterStage === "all"} onClick={() => setFilterStage("all")}>All</FilterButton>
              <FilterButton active={filterStage === "qualified"} onClick={() => setFilterStage("qualified")}>Qualified</FilterButton>
              <FilterButton active={filterStage === "onboarding_invited"} onClick={() => setFilterStage("onboarding_invited")}>Invited</FilterButton>
              <FilterButton active={filterStage === "new"} onClick={() => setFilterStage("new")}>New</FilterButton>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProspects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No prospects found</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Showing all {filteredProspects.length} prospects</p>
              {filteredProspects.map((p) => (
                <ProspectRow
                  key={p.id}
                  prospect={p}
                  expanded={expandedProspect === p.id}
                  onToggle={() => setExpandedProspect(expandedProspect === p.id ? null : p.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Onboarding Sessions Tab */}
      {activeSection === "onboarding" && (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Onboarding Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No onboarding sessions yet</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Activity Tab */}
      {activeSection === "activity" && (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Live Activity Feed ({activity.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {activity.slice(0, 30).map((a) => (
                <ActivityDetailRow key={a.id} activity={a} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
}

function ActivityDetailRow({ activity: a }: { activity: ActivityItem }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-2 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 ${a.success ? "text-green-500" : "text-red-500"} flex-shrink-0`}>
            {a.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">{a.agent}</span>
              <Badge variant="secondary" className="text-[9px]">{a.action}</Badge>
              <span className="text-[9px] text-muted-foreground ml-auto">
                {new Date(a.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {a.result && !expanded && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {Object.entries(a.result).slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(" • ")}
              </p>
            )}
            {expanded && (
              <ChevronDown className="h-3 w-3 text-muted-foreground mt-1" />
            )}
            {!expanded && (
              <ChevronRight className="h-3 w-3 text-muted-foreground mt-1 inline-block" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 p-3 bg-background/40 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Agent</p>
              <p className="text-xs">{a.agent} ({a.agentRole})</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Action</p>
              <p className="text-xs font-mono">{a.action}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Timestamp</p>
              <p className="text-xs">{new Date(a.timestamp).toLocaleString("en-US")}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Status</p>
              <p className={`text-xs ${a.success ? "text-green-600" : "text-red-600"}`}>
                {a.success ? "✓ Success" : "✗ Failed"}
              </p>
            </div>
            {a.result && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Full Result Details</p>
                <pre className="text-[10px] font-mono bg-muted/40 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(a.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon, onClick }: { label: string; value: number; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className={`text-center ${onClick ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ProspectRow({ prospect, expanded, onToggle }: { prospect: Prospect; expanded: boolean; onToggle: () => void }) {
  const scoreColor = prospect.aiScore >= 90 ? "text-green-600" : prospect.aiScore >= 75 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`text-lg font-bold ${scoreColor} w-10 text-center`}>
              {prospect.aiScore || "—"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{prospect.name}</span>
                {prospect.dotNumber && (
                  <Badge variant="outline" className="text-[10px]">DOT: {prospect.dotNumber}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {prospect.location} • {prospect.equipment} • Added: {new Date(prospect.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={prospect.status === "qualified" || prospect.status === "onboarding_invited" ? "default" : "secondary"} className="text-[10px] capitalize">
              {prospect.status?.replace(/_/g, " ")}
            </Badge>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 p-3 bg-muted/10 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <InfoRow label="DOT Number" value={prospect.dotNumber} />
            <InfoRow label="AI Score" value={`${prospect.aiScore}/100`} />
            <InfoRow label="Phone" value={prospect.phone || "Not available"} />
            <InfoRow label="Email" value={prospect.email || "Not available"} />
            <InfoRow label="Power Units" value={String(prospect.powerUnits || "—")} />
            <InfoRow label="Drivers" value={String(prospect.drivers || "—")} />
            <InfoRow label="Safety Rating" value={prospect.safetyRating || "Not rated"} />
            <InfoRow label="Authority" value={prospect.authorityStatus || "Unknown"} />
            <InfoRow label="Source" value={prospect.source} />
            <InfoRow label="Created" value={new Date(prospect.createdAt).toLocaleString("en-US")} />
          </div>

          {prospect.interestSignals && prospect.interestSignals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Interest Signals</p>
              <div className="flex flex-wrap gap-1">
                {prospect.interestSignals.map((sig, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{sig}</Badge>
                ))}
              </div>
            </div>
          )}

          {prospect.sourceUrl && (
            <a
              href={prospect.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on FMCSA SAFER
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 pb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function SessionRow({ session }: { session: OnboardingSession }) {
  const isExpired = new Date(session.expiresAt) < new Date();
  const statusColor = session.status === "completed" ? "default" : isExpired ? "destructive" : "secondary";

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{session.leadName}</span>
            {session.aiScore && <Badge variant="outline" className="text-[10px]">Score: {session.aiScore}</Badge>}
            <Badge variant={statusColor as any} className="text-[10px] capitalize">{session.status}</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
            <p>To: {session.leadEmail || "No email"}</p>
            <p>Created: {new Date(session.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            {session.completedAt && (
              <p className="text-green-600">Completed: {new Date(session.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            )}
          </div>
        </div>
        <a
          href={session.onboardingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
          View Portal
        </a>
      </div>
    </div>
  );
}