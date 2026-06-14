"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { convertDriverLeadAction, convertQuoteLeadAction, deleteLeadAction, updateLeadAction } from "@/app/actions/admin";
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
  Search,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Shield,
  Wrench,
  ExternalLink,
  ChevronLeft,
  Eye,
  Settings,
  Play,
  Pause,
  ChevronRight,
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
  key: string;
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
    new: { bg: "bg-slate-500/15", text: "text-slate-700", border: "border-slate-500/30", dot: "bg-slate-500" },
    contacted: { bg: "bg-blue-500/15", text: "text-blue-700", border: "border-blue-500/30", dot: "bg-blue-500" },
    qualified: { bg: "bg-green-500/15", text: "text-green-700", border: "border-green-500/30", dot: "bg-green-500" },
    converted: { bg: "bg-emerald-500/15", text: "text-emerald-700", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    onboarding: { bg: "bg-indigo-500/15", text: "text-indigo-700", border: "border-indigo-500/30", dot: "bg-indigo-500" },
    compliance_check: { bg: "bg-amber-500/15", text: "text-amber-700", border: "border-amber-500/30", dot: "bg-amber-500" },
    ready_to_dispatch: { bg: "bg-emerald-500/15", text: "text-emerald-700", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    lost: { bg: "bg-red-500/15", text: "text-red-700", border: "border-red-500/30", dot: "bg-red-500" },
    rejected: { bg: "bg-red-500/15", text: "text-red-700", border: "border-red-500/30", dot: "bg-red-500" },
  };
  const c = configs[status as keyof typeof configs] || { bg: "bg-gray-500/15", text: "text-gray-700", border: "border-gray-500/30", dot: "bg-gray-500" };
  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} ${c.border} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.split("_").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")}
    </Badge>
  );
}

// ===== PIPELINE DETAIL MODAL =====
interface PipelineDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  leads: any[];
  stageKey: string;
  pipelineType: "quote" | "driver";
  onViewDetail: (detail: { isOpen: boolean; lead: any; pipelineType: "quote" | "driver" }) => void;
}

function PipelineDetailModal({ isOpen, onClose, title, leads, stageKey, pipelineType, onViewDetail }: PipelineDetailModalProps) {
  if (!isOpen) return null;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState<"newest" | "oldest" | "score">("newest");

  const handleSortByChange = (value: string) => {
    setSortBy(value as "newest" | "oldest" | "score");
  };

  const filtered = leads
    .filter(l => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (l.name || l.fullName || "").toLowerCase();
        const email = (l.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.score || 0) - (a.score || 0);
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sortBy === "newest" ? tb - ta : ta - tb;
    });

  const stats = {
    total: leads.length,
    qualified: leads.filter(l => (l.score || 0) >= 75).length,
    premium: leads.filter(l => l.quality === "premium").length,
    converted: leads.filter(l => l.status === "converted").length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} leads • {stageKey} stage</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="compliance_check">Compliance</SelectItem>
                  <SelectItem value="ready_to_dispatch">Ready</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={handleSortByChange}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="score">Highest Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        <div className="p-4 border-b border-border/60 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Search name, email..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Qualified</div>
              <div className="text-lg font-semibold text-blue-600">{stats.qualified}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Premium</div>
              <div className="text-lg font-semibold text-purple-600">{stats.premium}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
              <div className="text-xs text-muted-foreground">Converted</div>
              <div className="text-lg font-semibold text-green-600">{stats.converted}</div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No leads in this stage matching filters</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(lead => (
                <LeadCard key={lead._id || lead.id} lead={lead} pipelineType={pipelineType} onViewDetail={onViewDetail} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeadDetailModal({ isOpen, onClose, lead, pipelineType }: { isOpen: boolean; onClose: () => void; lead: any; pipelineType: "quote" | "driver" }) {
  if (!isOpen) return null;

  const isDriver = pipelineType === "driver";
  const name = isDriver ? (lead.fullName || lead.name || "—") : (lead.name || lead.company || "—");
  const email = lead.email || "—";
  const phone = lead.phone || "—";
  const score = lead.score || 0;
  const quality = lead.quality || "low";
  const status = lead.status || "new";
  const createdAt = lead.createdAt ? formatRelativeTime(new Date(lead.createdAt).toISOString()) : "Unknown";

  const formatField = (label: string, value: string) => {
    if (!value || value === "—" || value === "") return null;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
        <span className="text-xs font-medium text-foreground truncate">{value}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{isDriver ? "🚛 Driver Application" : "📦 Quote Request"} Details</h2>
            <p className="text-sm text-muted-foreground">{name} • {createdAt}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid gap-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isDriver ? <UserCheck className="h-5 w-5 text-orange-500" /> : <FileText className="h-5 w-5 text-blue-500" />}
                  Applicant Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {formatField("Name", isDriver ? (lead.fullName || lead.name || "—") : (lead.name || lead.company || "—"))}
                {formatField("Email", lead.email || "—")}
                {formatField("Phone", lead.phone || "—")}
                {formatField("Status", status)}
                {formatField("Quality Score", `${quality} (${score}/100)`)}
                {formatField("Applied", lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "Unknown")}
              </CardContent>
            </Card>

            {isDriver ? (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-orange-500" />
                    Driver Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formatField("Truck Type", lead.truckType || "—")}
                  {formatField("Experience", lead.yearsExperience || "—")}
                  {formatField("Authority", lead.hasOwnAuthority ? "Own Authority" : (lead.authorityStatus || "Lease"))}
                  {formatField("Endorsements", lead.endorsements?.length ? lead.endorsements.join(", ") : "—")}
                  {formatField("Preferred Routes", lead.preferredRoutes || "—")}
                  {formatField("Start Date", lead.startDate || "—")}
                  {formatField("CDL Class", lead.cdlClass || "—")}
                  {formatField("Available Date", lead.availableDate || "—")}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    Quote Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formatField("Company", lead.company || "—")}
                  {formatField("Service Type", lead.serviceType || "—")}
                  {formatField("Route", `${lead.pickupLocation || "—"} → ${lead.dropoffLocation || "—"}`)}
                  {formatField("Pickup Date", lead.pickupDate || "—")}
                  {formatField("Urgency", lead.urgency || "normal")}
                  {formatField("Estimated Weight", lead.estimatedWeight || "—")}
                </CardContent>
              </Card>
            )}

            {lead.notes && lead.notes.length > 0 && (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{Array.isArray(lead.notes) ? lead.notes.join("\n") : lead.notes}</div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Source & Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {formatField("Source", lead.source || "web")}
                {formatField("Source URL", lead.sourceUrl || "—")}
                {formatField("IP Address", lead.ipAddress || "—")}
                {formatField("User Agent", lead.userAgent || "—")}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, pipelineType, onViewDetail }: { lead: any; pipelineType: "quote" | "driver"; onViewDetail: (detail: { isOpen: boolean; lead: any; pipelineType: "quote" | "driver" }) => void }) {
  const isDriver = pipelineType === "driver";
  const name = isDriver ? (lead.fullName || lead.name || "—") : (lead.name || lead.company || "—");
  const email = lead.email || "—";
  const phone = lead.phone || "—";
  const score = lead.score || 0;
  const quality = lead.quality || "low";
  const status = lead.status || "new";
  
  // Driver-specific
  const truckType = lead.truckType || "—";
  const yearsExpRaw = lead.yearsExperience || "—";
  const yearsExp = yearsExpRaw.toString().toLowerCase().includes("yr") || yearsExpRaw.toString().toLowerCase().includes("year") 
    ? yearsExpRaw 
    : `${yearsExpRaw} yrs`;
  const authority = lead.hasOwnAuthority ? "Own Authority" : lead.authorityStatus || "Lease";
  const endorsements = lead.endorsements?.length ? lead.endorsements.join(", ") : "—";
  const preferredRoutesRaw = lead.preferredRoutes || "";
  const preferredRoutes = preferredRoutesRaw.trim() ? preferredRoutesRaw : "—";
  
  // Quote-specific
  const company = lead.company || "—";
  const serviceType = lead.serviceType || "—";
  const pickup = lead.pickupLocation || "—";
  const dropoff = lead.dropoffLocation || "—";
  const pickupDate = lead.pickupDate || "—";
  const urgency = lead.urgency || "normal";

  return (
    <Card className="border-border/60 hover:border-primary/30 transition-colors flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${isDriver ? "bg-orange-500" : "bg-blue-500"} flex items-center justify-center text-white`}>
              {isDriver ? <UserCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <div className="font-semibold text-sm">{name}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {getStatusBadge(status)}
            <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${
              quality === "premium" ? "border-purple-500/30 text-purple-700" :
              quality === "high" ? "border-green-500/30 text-green-700" :
              quality === "medium" ? "border-blue-500/30 text-blue-700" :
              "border-gray-500/30 text-gray-700"
            }`}>
              {quality} ({score})
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 text-sm">
        {isDriver ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Truck:</span> <span className="font-medium ml-1">{truckType}</span></div>
              <div><span className="text-muted-foreground">Exp:</span> <span className="font-medium ml-1">{yearsExp} yrs</span></div>
              <div><span className="text-muted-foreground">Authority:</span> <span className="font-medium ml-1">{authority}</span></div>
              <div><span className="text-muted-foreground">Routes:</span> <span className="font-medium ml-1 truncate">{preferredRoutes}</span></div>
            </div>
            {endorsements !== "—" && (
              <div className="text-xs text-muted-foreground"><span className="font-medium">Endorsements:</span> {endorsements}</div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Company:</span> <span className="font-medium ml-1">{company}</span></div>
              <div><span className="text-muted-foreground">Service:</span> <span className="font-medium ml-1">{serviceType}</span></div>
              <div><span className="text-muted-foreground">Route:</span> <span className="font-medium ml-1 truncate">{pickup} → {dropoff}</span></div>
              <div><span className="text-muted-foreground">Date:</span> <span className="font-medium ml-1">{pickupDate}</span></div>
            </div>
            {urgency !== "normal" && <div className="text-xs text-amber-600 font-medium">⚡ {urgency.toUpperCase()}</div>}
          </>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground">
            {lead.createdAt ? formatRelativeTime(new Date(lead.createdAt).toISOString()) : "Unknown"}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="View details" onClick={() => onViewDetail({ isOpen: true, lead, pipelineType })}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Email" onClick={() => window.open(`mailto:${email}`)}>
              <Mail className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Call" onClick={() => window.open(`tel:${phone}`)}>
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== MAIN COMPONENT =====
export function LeadEngineV2({ quoteLeads, driverLeads }: LeadEngineV2Props) {
  const allLeads = [...quoteLeads, ...driverLeads];
  
  // Pipeline detail modal state
  const [pipelineDetail, setPipelineDetail] = React.useState<{
    isOpen: boolean;
    title: string;
    leads: any[];
    stageKey: string;
    pipelineType: "quote" | "driver";
  } | null>(null);

  // Lead detail modal state
  const [leadDetail, setLeadDetail] = React.useState<{
    isOpen: boolean;
    lead: any;
    pipelineType: "quote" | "driver";
  } | null>(null);

  // ===== COMPUTED KPIs =====
  const totalLeads = allLeads.length;
  const qualifiedLeads = allLeads.filter(l => (l.score || 0) >= 75).length;
  const premiumLeads = allLeads.filter(l => l.quality === "premium").length;
  const convertedLeads = allLeads.filter(l => l.status === "converted").length;
  const pipelineValue = allLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const avgScore = totalLeads > 0 ? Math.round(allLeads.reduce((s, l) => s + (l.score || 0), 0) / totalLeads) : 0;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";

  // Lease agreements count (from separate collection)
  const leaseAgreementsCount = 0; // TODO: Fetch from lease_agreements collection

  const convertedWithDates = allLeads.filter(l => l.status === "converted" && l.createdAt && l.convertedAt);
  const avgSpeedToRevenue = convertedWithDates.length > 0
    ? Math.round(convertedWithDates.reduce((s, l) => {
        const created = new Date(l.createdAt).getTime();
        const converted = new Date(l.convertedAt).getTime();
        return s + (converted - created) / 86400000;
      }, 0) / convertedWithDates.length)
    : 0;

  // ===== PIPELINE STAGES WITH DRILLDOWN =====
  const quoteStages: PipelineStage[] = [
    { name: "New", key: "new", count: quoteLeads.filter(l => l.status === "new").length, color: "bg-slate-500", icon: <Users className="h-4 w-4" /> },
    { name: "Qualified", key: "qualified", count: quoteLeads.filter(l => (l.score || 0) >= 70).length, color: "bg-blue-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Quoted", key: "quoted", count: quoteLeads.filter(l => l.status === "quoted").length, color: "bg-indigo-500", icon: <DollarSign className="h-4 w-4" /> },
    { name: "Negotiating", key: "negotiating", count: quoteLeads.filter(l => l.status === "negotiating").length, color: "bg-amber-500", icon: <ArrowRight className="h-4 w-4" /> },
    { name: "Won", key: "converted", count: quoteLeads.filter(l => l.status === "converted").length, color: "bg-green-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Lost", key: "lost", count: quoteLeads.filter(l => l.status === "lost" || l.status === "archived").length, color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  const driverStages: PipelineStage[] = [
    { name: "Applied", key: "new", count: driverLeads.filter(l => l.status === "new").length, color: "bg-slate-500", icon: <Users className="h-4 w-4" /> },
    { name: "Qualified", key: "qualified", count: driverLeads.filter(l => (l.score || 0) >= 75).length, color: "bg-blue-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Onboarding", key: "onboarding", count: driverLeads.filter(l => l.status === "onboarding").length, color: "bg-indigo-500", icon: <Truck className="h-4 w-4" /> },
    { name: "Compliance", key: "compliance_check", count: driverLeads.filter(l => l.status === "compliance_check").length, color: "bg-amber-500", icon: <Shield className="h-4 w-4" /> },
    { name: "Ready", key: "ready_to_dispatch", count: driverLeads.filter(l => l.status === "ready_to_dispatch").length, color: "bg-green-500", icon: <CheckCircle className="h-4 w-4" /> },
    { name: "Lease Agreement", key: "lease_agreement", count: leaseAgreementsCount, color: "bg-purple-500", icon: <FileText className="h-4 w-4" /> },
    { name: "Rejected", key: "rejected", count: driverLeads.filter(l => l.status === "rejected").length, color: "bg-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

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

  // Helper to open detail modal
  const openPipelineDetail = (stage: PipelineStage, pipelineType: "quote" | "driver") => {
    const leads = pipelineType === "quote" ? quoteLeads : driverLeads;
    const stageLeads = leads.filter(l => l.status === stage.key);
    setPipelineDetail({
      isOpen: true,
      title: `${pipelineType === "driver" ? "🚛 Driver" : "📦 Quote"} Pipeline → ${stage.name}`,
      leads: stageLeads,
      stageKey: stage.name,
      pipelineType,
    });
  };

  // ===== AGENT STATUS =====
  const agentStatuses: AgentStatus[] = [
    { id: "lead_generation", ...AGENT_CONFIG.lead_generation, status: "active", currentTask: "Prospecting TX-LA lanes", lastAction: "Found 7 prospects", tasksToday: 3 },
    { id: "sales", ...AGENT_CONFIG.sales, status: "active", currentTask: "Building quote for Texas Manufacturing", lastAction: "Sent 2 quotes", tasksToday: 5 },
    { id: "ceo", ...AGENT_CONFIG.ceo, status: "idle", currentTask: "Awaiting premium lead escalation", lastAction: "Weekly review completed", tasksToday: 1 },
    { id: "operations", ...AGENT_CONFIG.operations, status: "busy", currentTask: "Scheduling 3 loads for Monday", lastAction: "Dispatched 1 load", tasksToday: 4 },
    { id: "hr", ...AGENT_CONFIG.hr, status: "active", currentTask: "Reviewing 3 driver applications", lastAction: "Onboarded 1 driver", tasksToday: 3 },
    { id: "finance", ...AGENT_CONFIG.finance, status: "idle", currentTask: "Processing weekly payroll", lastAction: "Generated 2 invoices", tasksToday: 2 },
    { id: "customer_success", ...AGENT_CONFIG.customer_success, status: "idle", currentTask: "Monitoring 3 active accounts", lastAction: "Completed 1 check-in", tasksToday: 1 },
    { id: "marketing", ...AGENT_CONFIG.marketing, status: "idle", currentTask: "Nurture campaign drafting", lastAction: "Sent 0 emails", tasksToday: 0 },
  ];

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
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">Live</Badge>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => window.location.reload()}>
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
          <Link key={i} href={kpi.href || "#"} className="block">
            <Card className="border-border/60 hover:border-primary/30 transition-colors group">
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
          </Link>
        ))}
      </div>

      {/* MAIN GRID: PIPELINE (2/3) + AGENTS (1/3) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* PIPELINE FUNNELS - Clickable stages */}
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
                  <React.Fragment key={stage.key}>
                    <button
                      onClick={() => openPipelineDetail(stage, "quote")}
                      className="flex flex-col items-center min-w-[100px] flex-shrink-0 relative group focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg p-1"
                    >
                      {i > 0 && stage.conversionRate !== undefined && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-amber-600 whitespace-nowrap group-hover:block hidden">
                          {stage.conversionRate}% ←
                        </div>
                      )}
                      <div className={`w-16 h-16 rounded-xl ${stage.color} flex items-center justify-center text-white shadow-lg relative z-10 group-hover:shadow-xl transition-shadow`}>
                        {stage.icon}
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-2xl font-bold text-foreground">{stage.count}</div>
                        <div className="text-xs font-medium text-muted-foreground">{stage.name}</div>
                      </div>
                    </button>
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

          {/* DRIVER PIPELINE - ENHANCED FOCUS */}
          <Card className="border-border/60 ring-1 ring-orange-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-orange-500" />
                  Driver Pipeline <Badge variant="secondary" className="text-xs ml-2">FOCUS</Badge>
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {driverLeads.length} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {driverStagesWithRates.map((stage, i) => (
                  <React.Fragment key={stage.key}>
                    <button
                      onClick={() => openPipelineDetail(stage, "driver")}
                      className="flex flex-col items-center min-w-[100px] flex-shrink-0 relative group focus:outline-none focus:ring-2 focus:ring-orange-500/20 rounded-lg p-1"
                    >
                      {i > 0 && stage.conversionRate !== undefined && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium text-amber-600 whitespace-nowrap group-hover:block hidden">
                          {stage.conversionRate}% ←
                        </div>
                      )}
                      <div className={`w-16 h-16 rounded-xl ${stage.color} flex items-center justify-center text-white shadow-lg relative z-10 group-hover:shadow-xl transition-shadow ring-2 ring-orange-500/50`}>
                        {stage.icon}
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-2xl font-bold text-foreground">{stage.count}</div>
                        <div className="text-xs font-medium text-muted-foreground">{stage.name}</div>
                      </div>
                    </button>
                    {i < driverStagesWithRates.length - 1 && (
                      <div className="flex items-center h-16 w-8 text-slate-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {/* Driver Pipeline Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/60">
                <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Ready to Dispatch</div>
                  <div className="text-lg font-semibold text-green-600">{driverLeads.filter(l => l.status === "ready_to_dispatch").length}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground">In Compliance</div>
                  <div className="text-lg font-semibold text-amber-600">{driverLeads.filter(l => l.status === "compliance_check").length}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Onboarding</div>
                  <div className="text-lg font-semibold text-indigo-600">{driverLeads.filter(l => l.status === "onboarding").length}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground">Owner-Ops (≥75)</div>
                  <div className="text-lg font-semibold text-blue-600">{driverLeads.filter(l => (l.score || 0) >= 75 && l.hasOwnAuthority).length}</div>
                </div>
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
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
              <Link href="/api/admin/outbound-prospecting" className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center text-white">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Run Prospecting</p>
                  <p className="text-xs text-muted-foreground">Sofia finds new owner-operators</p>
                </div>
              </Link>
              <Link href="/admin/inbox?filter=new" className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Review New Leads</p>
                  <p className="text-xs text-muted-foreground">{allLeads.filter(l => l.status === "new").length} awaiting review</p>
                </div>
              </Link>
              <Link href="/api/admin/ai-activity" className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">Run Daily Ops</p>
                  <p className="text-xs text-muted-foreground">Process all pending actions</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PIPELINE DETAIL MODAL */}
      {pipelineDetail && (
        <PipelineDetailModal
          isOpen={pipelineDetail.isOpen}
          onClose={() => setPipelineDetail(null)}
          title={pipelineDetail.title}
          leads={pipelineDetail.leads}
          stageKey={pipelineDetail.stageKey}
          pipelineType={pipelineDetail.pipelineType}
          onViewDetail={setLeadDetail}
        />
      )}

      {/* LEAD DETAIL MODAL */}
      {leadDetail && (
        <LeadDetailModal
          isOpen={leadDetail.isOpen}
          onClose={() => setLeadDetail(null)}
          lead={leadDetail.lead}
          pipelineType={leadDetail.pipelineType}
        />
      )}
    </div>
  );
}