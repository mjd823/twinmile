import { redirect } from "next/navigation";

/**
 * /admin/inbox merged into /admin/lead-engine (Recruiting Pipeline).
 * The lead list + per-lead workflow lives in the "Applications & quotes" tab;
 * prospects live in the "Prospects" tab with real totals and pagination.
 */
export default function InboxRedirect() {
  redirect("/admin/lead-engine?tab=manual");
}
