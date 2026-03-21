"use client";

import * as React from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
  MapPin,
  Calendar,
  Hash,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  updateLeaseAgreementStatusAction,
  deleteLeaseAgreementAction,
  approveAndOnboardLeaseAction,
  setDocumentExpirationsAction,
} from "@/app/actions/admin";

export type LeaseAgreementSummary = {
  id: string;
  operatorName: string;
  operatorMcNumber: string;
  operatorEmail: string;
  operatorPhone: string;
  operatorAddress: string;
  operatorDate: string;
  status: string;
  onboardingStep: string;
  driverUserId: string | null;
  documentNames: Record<string, string>;
  createdAt: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending_review: {
    label: "Pending Review",
    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: "Approved",
    color: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: <XCircle className="h-3 w-3" />,
  },
  expired: {
    label: "Expired",
    color: "bg-muted text-muted-foreground border-border",
    icon: <Clock className="h-3 w-3" />,
  },
};

const DOC_LABELS: Record<string, string> = {
  cdl: "CDL",
  coi: "COI",
  registration: "Registration",
  w9: "W-9",
  dotPhysical: "DOT Physical",
};

export function AdminLeaseAgreements({
  agreements: initialAgreements,
}: {
  agreements: LeaseAgreementSummary[];
}) {
  const [agreements, setAgreements] = React.useState(initialAgreements);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");
  const [onboardId, setOnboardId] = React.useState<string | null>(null);
  const [onboardResult, setOnboardResult] = React.useState<string | null>(null);

  const filtered =
    filter === "all"
      ? agreements
      : agreements.filter((a) => a.status === filter);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: agreements.length };
    for (const a of agreements) {
      c[a.status] = (c[a.status] || 0) + 1;
    }
    return c;
  }, [agreements]);

  async function handleStatusChange(id: string, status: string) {
    setLoading(id);
    const result = await updateLeaseAgreementStatusAction({ id, status });
    if (result.ok) {
      setAgreements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
    setLoading(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lease agreement? This cannot be undone.")) return;
    setLoading(id);
    const result = await deleteLeaseAgreementAction({ id });
    if (result.ok) {
      setAgreements((prev) => prev.filter((a) => a.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
    setLoading(null);
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All" },
          { key: "pending_review", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
            {counts[tab.key] ? ` (${counts[tab.key]})` : ""}
          </button>
        ))}
      </div>

      {/* Agreements list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter === "all"
              ? "No lease agreements submitted yet."
              : `No ${STATUS_CONFIG[filter]?.label.toLowerCase() || filter} agreements.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((agreement) => {
            const isExpanded = expandedId === agreement.id;
            const isLoading = loading === agreement.id;
            const statusConfig =
              STATUS_CONFIG[agreement.status] || STATUS_CONFIG.pending_review;

            return (
              <Card
                key={agreement.id}
                className="border-border/60 overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Header row */}
                <div
                  className="flex cursor-pointer items-center gap-3 p-4"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : agreement.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {agreement.operatorName}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {agreement.operatorMcNumber && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {agreement.operatorMcNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {agreement.operatorAddress}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(agreement.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border/60 p-4 space-y-4">
                    {/* Operator details */}
                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Operator Name
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorName}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          MC Number
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorMcNumber || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Email
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorEmail || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Phone
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorPhone || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Address
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorAddress}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Agreement Date
                        </span>
                        <p className="font-medium text-foreground">
                          {agreement.operatorDate}
                        </p>
                      </div>
                    </div>

                    {/* Documents */}
                    <div>
                      <h4 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Uploaded Documents
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(agreement.documentNames).map(
                          ([field, fileName]) => (
                            <a
                              key={field}
                              href={`/api/lease-agreement/${agreement.id}/document/${field}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-primary/5 hover:border-primary/30"
                            >
                              <FileText className="h-4 w-4 shrink-0 text-primary" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {DOC_LABELS[field] || field}
                                </div>
                                <div className="truncate text-foreground text-xs">
                                  {fileName}
                                </div>
                              </div>
                              <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          )
                        )}
                      </div>
                    </div>

                    {/* Document Expiration Dates */}
                    {agreement.status === "approved" && (
                      <DocExpirationForm leaseId={agreement.id} documentNames={agreement.documentNames} />
                    )}

                    {/* Onboarding Status */}
                    {agreement.driverUserId && (
                      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                        <span className="font-medium text-green-400">Driver account created</span>
                        <span className="text-muted-foreground ml-2">ID: {agreement.driverUserId.slice(-8)}</span>
                        <span className="text-muted-foreground ml-2">·</span>
                        <span className="text-muted-foreground ml-2">Driver can log in at /driver/login</span>
                      </div>
                    )}

                    {/* Onboard Modal */}
                    {onboardId === agreement.id && !agreement.driverUserId && (
                      <OnboardForm
                        agreement={agreement}
                        loading={isLoading}
                        onSubmit={async (data) => {
                          setLoading(agreement.id);
                          setOnboardResult(null);
                          const result = await approveAndOnboardLeaseAction({
                            leaseId: agreement.id,
                            email: data.email,
                            firstName: data.firstName,
                            lastName: data.lastName,
                          });
                          if (result.ok) {
                            setOnboardResult(
                              `Account created. Temp password: ${result.tempPassword} — Send this to the driver securely.`
                            );
                            setAgreements((prev) =>
                              prev.map((a) =>
                                a.id === agreement.id
                                  ? { ...a, status: "approved", onboardingStep: "account_created", driverUserId: result.driverUserId }
                                  : a
                              )
                            );
                          } else {
                            setOnboardResult(result.error || "Failed to create account.");
                          }
                          setLoading(null);
                        }}
                        onCancel={() => { setOnboardId(null); setOnboardResult(null); }}
                        result={onboardResult}
                      />
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
                      {!agreement.driverUserId && agreement.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isLoading}
                          onClick={() => {
                            setOnboardId(agreement.id);
                            setOnboardResult(null);
                          }}
                        >
                          <User className="h-3.5 w-3.5 mr-1.5" />
                          Approve & Create Account
                        </Button>
                      )}
                      {!agreement.driverUserId && agreement.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() =>
                            handleStatusChange(agreement.id, "approved")
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Approve Only
                        </Button>
                      )}
                      {agreement.status !== "rejected" && !agreement.driverUserId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() =>
                            handleStatusChange(agreement.id, "rejected")
                          }
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Reject
                        </Button>
                      )}
                      {agreement.status !== "pending_review" && !agreement.driverUserId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() =>
                            handleStatusChange(agreement.id, "pending_review")
                          }
                        >
                          <Clock className="h-3.5 w-3.5 mr-1.5" />
                          Set Pending
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isLoading}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(agreement.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Onboard Form (inline) ───────────────────────────────────────────

function OnboardForm({
  agreement,
  loading,
  onSubmit,
  onCancel,
  result,
}: {
  agreement: LeaseAgreementSummary;
  loading: boolean;
  onSubmit: (data: { email: string; firstName: string; lastName: string }) => void;
  onCancel: () => void;
  result: string | null;
}) {
  const nameParts = agreement.operatorName.trim().split(/\s+/);
  const [email, setEmail] = React.useState(agreement.operatorEmail || "");
  const [firstName, setFirstName] = React.useState(nameParts[0] || "");
  const [lastName, setLastName] = React.useState(
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""
  );

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="text-sm font-semibold text-foreground">
        Approve & Create Driver Account
      </div>
      <p className="text-xs text-muted-foreground">
        This will approve the lease, create a driver login, and generate a
        temporary password. Send the credentials to the driver securely.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            First Name
          </label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.currentTarget.value)}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Last Name
          </label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.currentTarget.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Driver Email (used for login)
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="h-8 text-sm"
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={loading || !email || !firstName}
          onClick={() => onSubmit({ email, firstName, lastName })}
        >
          {loading ? "Creating…" : "Create Account & Approve"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
      {result && (
        <div className="rounded-md border border-border/60 bg-background/50 p-3 text-sm text-foreground font-mono select-all">
          {result}
        </div>
      )}
    </div>
  );
}

// ── Document Expiration Form ────────────────────────────────────────

function DocExpirationForm({
  leaseId,
  documentNames,
}: {
  leaseId: string;
  documentNames: Record<string, string>;
}) {
  const [expirations, setExpirations] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const result = await setDocumentExpirationsAction({
      leaseId,
      expirations,
    });
    if (result.ok) {
      setMsg("Expiration dates saved.");
    } else {
      setMsg(result.error || "Failed to save.");
    }
    setSaving(false);
  }

  const docKeys = Object.keys(documentNames);
  if (docKeys.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Document Expiration Dates
      </div>
      <p className="text-xs text-muted-foreground">
        Set expiration dates for compliance tracking. You'll see alerts when documents are expiring.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {docKeys.map((key) => (
          <div key={key} className="grid gap-1">
            <label className="text-xs text-muted-foreground">{DOC_LABELS[key] ?? key}</label>
            <Input
              type="date"
              className="h-7 text-xs"
              value={expirations[key] ?? ""}
              onChange={(e) =>
                setExpirations((prev) => ({ ...prev, [key]: e.currentTarget.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Expiration Dates"}
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
