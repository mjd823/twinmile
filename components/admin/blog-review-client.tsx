"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Pencil,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Admin review UI for the auto-blog pipeline (/admin/blog).
 *
 * AI drafts land here with status "draft"; a human reads, optionally edits,
 * then publishes or rejects. Follows the social-packs-client patterns.
 */

interface Citation {
  url: string;
  title: string;
  source: string;
  verified: boolean;
  httpStatus?: number;
}

interface Section {
  heading: string;
  paragraphs: string[];
}

interface PipelinePost {
  _id: string;
  slug: string;
  title: string;
  description: string;
  sections: Section[];
  citations: Citation[];
  status: "draft" | "published" | "rejected";
  needsWork: boolean;
  reviewNotes: string[];
  topicId: string;
  model: string;
  wordCount: number;
  readingTime: string;
  createdAt?: string;
  publishedAt?: string;
}

/** Serialize sections to an editable plain-text format: "## Heading" lines + blank-line-separated paragraphs. */
function sectionsToText(sections: Section[]): string {
  return sections
    .map((s) => [`## ${s.heading}`, ...s.paragraphs].join("\n\n"))
    .join("\n\n");
}

function textToSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const block of text.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      current = { heading: trimmed.slice(3).trim(), paragraphs: [] };
      sections.push(current);
    } else if (current) {
      current.paragraphs.push(trimmed.replace(/\n/g, " "));
    } else {
      current = { heading: "Overview", paragraphs: [trimmed.replace(/\n/g, " ")] };
      sections.push(current);
    }
  }
  return sections;
}

const STATUS_BADGE: Record<PipelinePost["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Draft — awaiting review", variant: "default" },
  published: { label: "Published", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function BlogReviewClient() {
  const [posts, setPosts] = React.useState<PipelinePost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null); // post id or "generate"
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editBody, setEditBody] = React.useState("");

  const loadPosts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blog?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setError(null);
    } catch (err) {
      console.error("Error loading blog posts:", err);
      setError("Could not load the blog pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleGenerate = async () => {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Generation failed (${res.status})`);
      if (!result.created && result.reason) setError(result.reason);
      await loadPosts();
    } catch (err) {
      console.error("Error generating draft:", err);
      setError(err instanceof Error ? err.message : "Failed to generate a draft.");
    } finally {
      setBusy(null);
    }
  };

  const patchPost = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Request failed (${res.status})`);
      await loadPosts();
      return true;
    } catch (err) {
      console.error("Error updating post:", err);
      setError(err instanceof Error ? err.message : "Failed to update the post.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async (post: PipelinePost) => {
    if (
      post.needsWork &&
      !confirm(
        "This draft is flagged needsWork:\n\n" +
          post.reviewNotes.join("\n") +
          "\n\nPublish anyway?"
      )
    ) {
      return;
    }
    if (!post.needsWork && !confirm(`Publish "${post.title}" to twinmile.com/blog?`)) return;
    await patchPost(post._id, { action: "publish" });
  };

  const handleReject = async (post: PipelinePost) => {
    if (!confirm(`Reject "${post.title}"? It stays in the archive but never goes public.`)) return;
    await patchPost(post._id, { action: "reject" });
  };

  const startEditing = (post: PipelinePost) => {
    setEditingId(post._id);
    setEditTitle(post.title);
    setEditDescription(post.description);
    setEditBody(sectionsToText(post.sections));
  };

  const handleSave = async (post: PipelinePost) => {
    const ok = await patchPost(post._id, {
      action: "update",
      title: editTitle,
      description: editDescription,
      sections: textToSections(editBody),
    });
    if (ok) setEditingId(null);
  };

  const drafts = posts.filter((p) => p.status === "draft");
  const published = posts.filter((p) => p.status === "published");
  const rejected = posts.filter((p) => p.status === "rejected");

  const renderPost = (post: PipelinePost) => {
    const isEditing = editingId === post._id;
    const badge = STATUS_BADGE[post.status];
    return (
      <Card key={post._id} className={post.needsWork && post.status === "draft" ? "border-amber-500/40" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {post.title}
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {post.needsWork && post.status === "draft" && (
              <Badge variant="destructive">Needs work</Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            /blog/{post.slug} · {post.wordCount} words · {post.readingTime} · topic:{" "}
            {post.topicId} · model: {post.model}
            {post.publishedAt ? ` · published ${post.publishedAt.slice(0, 10)}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {post.reviewNotes.length > 0 && post.status === "draft" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Reviewer notes
              </div>
              <ul className="list-disc pl-5">
                {post.reviewNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Meta description
                </label>
                <Textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Body — &quot;## Heading&quot; lines start a section; blank lines separate paragraphs
                </label>
                <Textarea
                  rows={18}
                  className="font-mono text-xs"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave(post)} disabled={busy === post._id}>
                  <Check className="mr-1 h-4 w-4" /> Save changes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{post.description}</p>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-md bg-muted p-4 text-sm">
                {post.sections.map((s, i) => (
                  <div key={i}>
                    <div className="font-semibold">{s.heading}</div>
                    {s.paragraphs.map((p, j) => (
                      <p key={j} className="mt-1 text-muted-foreground">
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Citations (HTTP-verified at generation)
            </div>
            <ul className="space-y-1">
              {post.citations.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {c.verified ? (
                    <Badge variant="secondary" className="shrink-0">
                      {c.httpStatus ?? "OK"}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0">
                      unverified
                    </Badge>
                  )}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 truncate text-primary underline-offset-4 hover:underline"
                  >
                    <span className="truncate">
                      [{c.source}] {c.title}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              ))}
              {post.citations.length === 0 && (
                <li className="text-sm text-muted-foreground">No citations.</li>
              )}
            </ul>
          </div>

          {post.status === "draft" && !isEditing && (
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <Button size="sm" onClick={() => handlePublish(post)} disabled={busy === post._id}>
                <Send className="mr-1 h-4 w-4" /> Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => startEditing(post)}>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => handleReject(post)}
                disabled={busy === post._id}
              >
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          )}
          {post.status === "published" && (
            <div className="border-t border-border/60 pt-3">
              <Button size="sm" variant="outline" asChild>
                <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" /> View live
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="h-6 w-6 text-primary" />
            Blog Pipeline
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI drafts one article a week (Mondays 15:00 UTC) with verified .gov citations.
            Nothing goes live until you publish it here.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={busy === "generate"}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy === "generate" ? "animate-spin" : ""}`} />
          {busy === "generate" ? "Generating…" : "Generate draft now"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading pipeline…</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pipeline posts yet. Generate a draft to get started — the 8 original articles
            stay live on /blog regardless.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Awaiting review ({drafts.length})</h2>
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drafts waiting. The next one arrives Monday.
              </p>
            ) : (
              drafts.map(renderPost)
            )}
          </section>

          {published.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Published ({published.length})</h2>
              {published.map(renderPost)}
            </section>
          )}

          {rejected.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Rejected ({rejected.length})</h2>
              {rejected.map(renderPost)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
