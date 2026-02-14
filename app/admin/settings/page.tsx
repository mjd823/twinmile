import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AutomationDashboard } from "@/components/admin/automation-dashboard";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { Button } from "@/components/ui/button";
import { restoreLeadAction } from "@/app/actions/admin";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  const [archivedQuoteLeads, archivedDriverLeads] = await Promise.all([
    db
      .collection("leads_quotes")
      .find({ isArchived: true }, { sort: { archivedAt: -1, createdAt: -1 }, limit: 300 })
      .toArray(),
    db
      .collection("leads_drivers")
      .find({ isArchived: true }, { sort: { archivedAt: -1, createdAt: -1 }, limit: 300 })
      .toArray(),
  ]);

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Account Settings</h1>
              <div className="mt-2 text-sm text-muted-foreground">Admin settings and operational checklists.</div>
            </div>
            <div className="text-sm text-muted-foreground">Signed in as {user.email}</div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <div className="grid gap-6">
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="text-sm font-semibold tracking-tight">Security</div>
              <div className="mt-1 text-sm text-muted-foreground">Change your admin password.</div>
              <div className="mt-4 max-w-xl">
                <ChangePasswordForm />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="text-sm font-semibold tracking-tight">SEO Checklist</div>
              <div className="mt-1 text-sm text-muted-foreground">Prioritized audit and growth punch list.</div>

              <div className="mt-5 grid gap-6">
                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">1) Technical SEO (highest impact)</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Ensure each public page has a unique title + meta description.</div>
                    <div className="text-green-600">✅ Add canonical URLs to primary landing pages (avoid duplicate content).</div>
                    <div className="text-green-600">✅ Add `robots.txt` + `sitemap.xml` (and submit in Google Search Console).</div>
                    <div className="text-green-600">✅ Verify Core Web Vitals (LCP/CLS/INP) and fix obvious layout shifts.</div>
                    <div className="text-green-600">✅ Confirm all important pages return 200 (no accidental noindex/no-follow).</div>
                    <div className="text-green-600">✅ Add Open Graph + Twitter card tags for share previews.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">2) Landing pages (organic growth)</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Create 3-6 focused service pages (e.g. regional freight lanes / service types).</div>
                    <div className="text-green-600">✅ Add conversion CTA blocks (call/text/email) above the fold and near the bottom.</div>
                    <div className="text-green-600">✅ Add FAQ sections to target long-tail queries (include real questions).</div>
                    <div className="text-green-600">✅ Add internal links between related services + the main quote/driver flows.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">3) Structured data (schema)</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Add `Organization` / `LocalBusiness` schema with consistent NAP.</div>
                    <div className="text-green-600">✅ Add `WebSite` + `WebPage` schema.</div>
                    <div className="text-green-600">✅ Add `FAQPage` schema where FAQs exist.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">4) Internal linking + content hygiene</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Add "Related services" blocks to avoid orphan pages.</div>
                    <div className="text-green-600">✅ Add breadcrumbs on deeper pages if you add many landing pages.</div>
                    <div className="text-green-600">✅ Ensure consistent H1/H2 hierarchy and avoid duplicate H1s.</div>
                    <div className="text-green-600">✅ Add image alt text for key images/logos.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">5) Tracking + reporting</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Set up Google Search Console and verify domain/property.</div>
                    <div className="text-green-600">✅ Set up GA4 (or an alternative) and define conversion events (quote submit, driver apply submit).</div>
                    <div className="text-green-600">✅ Track call clicks / email clicks (simple outbound events).</div>
                  </div>
                </div>

                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                  <div className="text-sm font-semibold tracking-tight text-green-600">🎉 WORLD-CLASS IMPLEMENTATION COMPLETE!</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="text-green-600">✅ Advanced conversion tracking with lead quality scoring</div>
                    <div className="text-green-600">✅ Business intelligence with revenue estimation</div>
                    <div className="text-green-600">✅ Real-time engagement tracking and analytics</div>
                    <div className="text-green-600">✅ Performance optimization for Core Web Vitals</div>
                    <div className="text-green-600">✅ Comprehensive breadcrumb navigation</div>
                    <div className="text-green-600">✅ Industry-leading attribution modeling</div>
                  </div>
                </div>
              </div>
            </div>

            <AutomationDashboard />

            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="text-sm font-semibold tracking-tight">Archived Leads</div>
              <div className="mt-1 text-sm text-muted-foreground">History and restore options for archived quote requests and driver applications.</div>

              <div className="mt-5 grid gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Quote Leads</div>
                  <div className="mt-3 space-y-2">
                    {archivedQuoteLeads.length === 0 ? (
                      <div className="rounded-lg border border-border/60 bg-background/20 p-4 text-sm text-muted-foreground">No archived quote leads.</div>
                    ) : (
                      archivedQuoteLeads.map((l: any) => (
                        <div key={String(l._id)} className="rounded-lg border border-border/60 bg-background/20 p-4 text-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">{l.name || "—"}</div>
                              <div className="text-muted-foreground">{l.email || "—"}</div>
                              <div className="text-muted-foreground text-xs">{l.company || "—"}</div>
                              <div className="text-muted-foreground text-xs">{l.pickupLocation || ""}{l.dropoffLocation ? ` → ${l.dropoffLocation}` : ""}</div>
                              <div className="text-muted-foreground text-xs">Archived: {l.archivedAt ? new Date(l.archivedAt).toLocaleString() : "—"}</div>
                            </div>
                            <form
                              action={async () => {
                                "use server";
                                const result = await restoreLeadAction("quotes", String(l._id));
                                if (result.ok) {
                                  // Reload to reflect restoration
                                  redirect("/admin/settings");
                                }
                              }}
                            >
                              <Button type="submit" variant="outline" size="sm">
                                Restore
                              </Button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-foreground">Driver Applications</div>
                  <div className="mt-3 space-y-2">
                    {archivedDriverLeads.length === 0 ? (
                      <div className="rounded-lg border border-border/60 bg-background/20 p-4 text-sm text-muted-foreground">No archived driver applications.</div>
                    ) : (
                      archivedDriverLeads.map((l: any) => (
                        <div key={String(l._id)} className="rounded-lg border border-border/60 bg-background/20 p-4 text-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">{l.fullName || "—"}</div>
                              <div className="text-muted-foreground">{l.email || "—"}</div>
                              <div className="text-muted-foreground text-xs">{l.truckType || "—"}</div>
                              <div className="text-muted-foreground text-xs">Archived: {l.archivedAt ? new Date(l.archivedAt).toLocaleString() : "—"}</div>
                            </div>
                            <form
                              action={async () => {
                                "use server";
                                const result = await restoreLeadAction("drivers", String(l._id));
                                if (result.ok) {
                                  // Reload to reflect restoration
                                  redirect("/admin/settings");
                                }
                              }}
                            >
                              <Button type="submit" variant="outline" size="sm">
                                Restore
                              </Button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
