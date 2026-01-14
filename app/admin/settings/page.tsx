import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export const metadata: Metadata = {
  title: "Admin Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const user = await requireRole("admin");
  if (!user) return null;

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
                    <div>- Ensure each public page has a unique title + meta description.</div>
                    <div>- Add canonical URLs to primary landing pages (avoid duplicate content).</div>
                    <div>- Add `robots.txt` + `sitemap.xml` (and submit in Google Search Console).</div>
                    <div>- Verify Core Web Vitals (LCP/CLS/INP) and fix obvious layout shifts.</div>
                    <div>- Confirm all important pages return 200 (no accidental noindex/no-follow).</div>
                    <div>- Add Open Graph + Twitter card tags for share previews.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">2) Landing pages (organic growth)</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>- Create 3-6 focused service pages (e.g. regional freight lanes / service types).</div>
                    <div>- Add conversion CTA blocks (call/text/email) above the fold and near the bottom.</div>
                    <div>- Add FAQ sections to target long-tail queries (include real questions).</div>
                    <div>- Add internal links between related services + the main quote/driver flows.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">3) Structured data (schema)</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>- Add `Organization` / `LocalBusiness` schema with consistent NAP.</div>
                    <div>- Add `WebSite` + `WebPage` schema.</div>
                    <div>- Add `FAQPage` schema where FAQs exist.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">4) Internal linking + content hygiene</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>- Add “Related services” blocks to avoid orphan pages.</div>
                    <div>- Add breadcrumbs on deeper pages if you add many landing pages.</div>
                    <div>- Ensure consistent H1/H2 hierarchy and avoid duplicate H1s.</div>
                    <div>- Add image alt text for key images/logos.</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/20 p-4">
                  <div className="text-sm font-semibold tracking-tight">5) Tracking + reporting</div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>- Set up Google Search Console and verify domain/property.</div>
                    <div>- Set up GA4 (or an alternative) and define conversion events (quote submit, driver apply submit).</div>
                    <div>- Track call clicks / email clicks (simple outbound events).</div>
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
