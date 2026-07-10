"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Ear,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pageRangeLabel } from "@/lib/paginate";

/**
 * Sofia the Listener — mobile-first review queue of Reddit conversations
 * where an owner-operator is already asking for help. Each card shows the
 * post, the matched signals, and a drafted helpful reply MJ can copy.
 *
 * BOUNDARY (by design): nothing here posts to Reddit. Copy the draft, open
 * the thread, read it fully, adapt the reply, and post it as yourself.
 */

interface ListenerLead {
  postId: string;
  subreddit: string;
  url: string;
  author: string;
  title: string;
  snippet: string;
  matchedSignals: string[];
  score: number;
  draftReply: string;
  foundAt: string;
  status: "new" | "replied" | "dismissed";
}

const STATUS_FILTERS = ["new", "replied", "dismissed", "all"] as const;

interface PageMeta {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

const EMPTY_META: PageMeta = { total: 0, page: 1, pageCount: 1, pageSize: 50 };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ListenerClient() {
  const [leads, setLeads] = React.useState<ListenerLead[]>([]);
  const [meta, setMeta] = React.useState<PageMeta>(EMPTY_META);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<(typeof STATUS_FILTERS)[number]>("new");
  const [openDraft, setOpenDraft] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const loadLeads = React.useCallback(async (status: string, pageNum: number) => {
    try {
      const res = await fetch(`/api/admin/listener?status=${status}&page=${pageNum}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load leads (${res.status})`);
      const data = await res.json();
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setMeta({
        total: Number(data.total) || 0,
        page: Number(data.page) || 1,
        pageCount: Number(data.pageCount) || 1,
        pageSize: Number(data.pageSize) || EMPTY_META.pageSize,
      });
      setError(null);
    } catch (err) {
      console.error("Error loading listener leads:", err);
      setError("Could not load listener leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    loadLeads(filter, page);
  }, [filter, page, loadLeads]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/listener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan: true }),
      });
      if (!res.ok) throw new Error(`Scan failed (${res.status})`);
      await loadLeads(filter, page);
    } catch (err) {
      console.error("Error running scan:", err);
      setError("Scan failed — Reddit may be rate limiting; try again later.");
    } finally {
      setScanning(false);
    }
  };

  const handleStatus = async (lead: ListenerLead, action: "replied" | "dismissed") => {
    setBusyId(lead.postId);
    try {
      const res = await fetch("/api/admin/listener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: lead.postId, action }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      setLeads((prev) =>
        filter === "all"
          ? prev.map((l) => (l.postId === lead.postId ? { ...l, status: action } : l))
          : prev.filter((l) => l.postId !== lead.postId)
      );
      if (filter !== "all") {
        setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
      }
    } catch (err) {
      console.error("Error updating lead:", err);
      setError("Could not update the lead.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async (lead: ListenerLead) => {
    try {
      await navigator.clipboard.writeText(lead.draftReply);
      setCopiedId(lead.postId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Copy failed — select the text manually.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Ear className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Sofia the Listener</h1>
          <p className="text-sm text-muted-foreground">
            Truckers already asking for help on Reddit — with a drafted honest reply.
          </p>
        </div>
      </div>

      {/* Trust boundary — always visible. */}
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p>
          <span className="font-medium">Read-only listening.</span> Nothing is posted
          automatically — no bot comments, no auto-DMs. Read the full thread, adapt the
          draft in your own words, and post it yourself under your own account with the
          affiliation disclosed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={handleScan}
          disabled={scanning}
          className="ml-auto"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter + " "}leads yet. Sofia scans every 6 hours.
        </p>
      ) : (
        <>
        <ListenerPager meta={meta} loading={loading} onPage={setPage} />
        {leads.map((lead) => (
          <Card key={lead.postId}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{lead.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    r/{lead.subreddit} · u/{lead.author} · found {timeAgo(lead.foundAt)} ·
                    score {lead.score}
                  </p>
                </div>
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-primary hover:opacity-80"
                  aria-label="Open on Reddit"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {lead.snippet && lead.snippet !== lead.title && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {lead.snippet}
                  {lead.snippet.length >= 400 ? "…" : ""}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {lead.matchedSignals.map((sig) => (
                  <Badge
                    key={sig}
                    variant="outline"
                    className="border-sky-500/30 bg-sky-500/10 text-xs text-sky-400"
                  >
                    {sig}
                  </Badge>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenDraft(openDraft === lead.postId ? null : lead.postId)
                }
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium"
              >
                Drafted reply
                {openDraft === lead.postId ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {openDraft === lead.postId && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  <p className="whitespace-pre-wrap text-sm">{lead.draftReply}</p>
                  <Button size="sm" variant="secondary" onClick={() => handleCopy(lead)}>
                    {copiedId === lead.postId ? (
                      <>
                        <Check className="mr-1.5 h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-4 w-4" /> Copy reply
                      </>
                    )}
                  </Button>
                </div>
              )}

              {lead.status === "new" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={busyId === lead.postId}
                    onClick={() => handleStatus(lead, "replied")}
                  >
                    <Check className="mr-1.5 h-4 w-4" /> Mark Replied
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={busyId === lead.postId}
                    onClick={() => handleStatus(lead, "dismissed")}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Dismiss
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="capitalize">
                  {lead.status}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
        <ListenerPager meta={meta} loading={loading} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** Real total + prev/next — client-side twin of the shared <Pager>. */
function ListenerPager({
  meta,
  loading,
  onPage,
}: {
  meta: PageMeta;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs tabular-nums text-muted-foreground">
        {pageRangeLabel(meta)} · newest first
      </p>
      {meta.pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            page {meta.page.toLocaleString()} / {meta.pageCount.toLocaleString()}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || meta.page >= meta.pageCount}
            onClick={() => onPage(meta.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </nav>
      )}
    </div>
  );
}
