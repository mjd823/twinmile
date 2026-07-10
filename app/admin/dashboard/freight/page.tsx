import { redirect } from "next/navigation";

/**
 * /admin/dashboard/freight was a limit-100 quote-lead view whose only referrer
 * was the dead LeadEngineDashboard component — quote leads live in the
 * Recruiting Pipeline's "Applications & quotes" tab.
 */
export default function FreightDashboardRedirect() {
  redirect("/admin/lead-engine?tab=manual");
}
