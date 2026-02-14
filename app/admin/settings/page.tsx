import type { Metadata } from "next";

import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
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
