"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Megaphone,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Admin UI for the daily recruiting post packs — ported from
 * jaelynnsfashion app/admin/social/social-client.tsx, restyled for Twin Mile
 * (2 recruiting posts/day instead of 3 product posts).
 */

interface PackItem {
  slot: number;
  angleId: string;
  headline: string;
  sub: string;
  bullets: string[];
  caption: string;
  imageUrl: string;
  ctaUrl: string;
}

interface GroupPost {
  angleId: string;
  label: string;
  text: string;
  platforms: string[];
  rules: string;
}

interface Pack {
  _id?: string;
  date: string;
  items: PackItem[];
  groupPost?: GroupPost;
  createdAt?: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const ANGLE_LABELS: Record<string, string> = {
  "pay-transparency": "Pay transparency",
  "home-time": "Home time",
  "new-authority": "New authority",
  paperwork: "Paperwork handled",
};

export function SocialPacksClient() {
  const [packs, setPacks] = React.useState<Pack[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const loadPacks = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/social-pack?limit=14", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load packs (${res.status})`);
      const data = await res.json();
      setPacks(Array.isArray(data.packs) ? data.packs : []);
      setError(null);
    } catch (err) {
      console.error("Error loading social packs:", err);
      setError("Could not load social packs.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const today = todayUtc();
  const todayPack = packs.find((p) => p.date === today) || null;
  const latestPack = todayPack || packs[0] || null;
  const historyPacks = packs.filter((p) => p !== latestPack);

  const handleGenerate = async () => {
    if (
      todayPack &&
      !confirm("Regenerate today's pack? Captions will be rebuilt from the current templates.")
    ) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: Boolean(todayPack) }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      const result = await res.json();
      if (!result.pack && result.reason) {
        setError(result.reason);
      }
      await loadPacks();
    } catch (err) {
      console.error("Error generating social pack:", err);
      setError("Failed to generate the pack. Check server logs.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (key: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Megaphone className="h-6 w-6 text-primary" />
            Recruiting Post Pack
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            2 ready-to-post recruiting images + captions and 1 plain-text group post draft
            daily. Generated every morning at 13:45 UTC.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating
            ? "Generating…"
            : todayPack
              ? "Regenerate today's pack"
              : "Generate today's pack"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading packs…</p>
      ) : !latestPack ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No packs yet. Generate today&apos;s pack to get started.
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{latestPack.date}</h2>
            {latestPack.date === today ? <Badge>Today</Badge> : <Badge variant="secondary">Latest</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {latestPack.items.map((item) => {
              const key = `${latestPack.date}-${item.slot}`;
              return (
                <Card key={key} className="overflow-hidden">
                  <div className="bg-black">
                    {/* Rendered on demand by /api/social-image (1080x1350) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/social-image?date=${latestPack.date}&slot=${item.slot}`}
                      alt={item.headline.replace(/\n/g, " ")}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {ANGLE_LABELS[item.angleId] || item.angleId}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                      {item.caption}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopy(key, item.caption)}>
                        {copiedKey === key ? (
                          <Check className="mr-1 h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="mr-1 h-4 w-4" />
                        )}
                        {copiedKey === key ? "Copied" : "Copy caption"}
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`/api/social-image?date=${latestPack.date}&slot=${item.slot}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Image
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {latestPack.groupPost && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  Group post draft — {latestPack.groupPost.label}
                  <Badge variant="secondary">Human posts it</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  For: {latestPack.groupPost.platforms.join(" · ")}. No automation — Facebook
                  API removed (ToS); copy the text and post from MJ&apos;s real profile.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-relaxed">
                  {latestPack.groupPost.text}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCopy(`${latestPack.date}-group`, latestPack.groupPost!.text)
                    }
                  >
                    {copiedKey === `${latestPack.date}-group` ? (
                      <Check className="mr-1 h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="mr-1 h-4 w-4" />
                    )}
                    {copiedKey === `${latestPack.date}-group` ? "Copied" : "Copy group post"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {latestPack.groupPost.rules}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {historyPacks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">History</h2>
          <div className="space-y-6">
            {historyPacks.map((pack) => (
              <Card key={pack.date}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base">
                    {pack.date}
                    <span className="text-xs font-normal text-muted-foreground">
                      {pack.items.length} post{pack.items.length === 1 ? "" : "s"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {pack.items.map((item) => {
                      const key = `${pack.date}-${item.slot}`;
                      return (
                        <div key={key} className="flex gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/social-image?date=${pack.date}&slot=${item.slot}`}
                            alt={item.headline.replace(/\n/g, " ")}
                            className="h-24 w-20 shrink-0 rounded-md object-cover"
                          />
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">
                              {ANGLE_LABELS[item.angleId] || item.angleId}
                            </p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleCopy(key, item.caption)}
                              >
                                {copiedKey === key ? (
                                  <Check className="mr-1 h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="mr-1 h-3 w-3" />
                                )}
                                {copiedKey === key ? "Copied" : "Caption"}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                                <a
                                  href={`/api/social-image?date=${pack.date}&slot=${item.slot}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                >
                                  <Download className="mr-1 h-3 w-3" />
                                  Image
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
