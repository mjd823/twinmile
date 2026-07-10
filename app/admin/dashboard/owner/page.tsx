import { redirect } from "next/navigation";

/**
 * /admin/dashboard/owner was a limit-100 lead view whose only referrer was the
 * dead LeadEngineDashboard component — merged into the Recruiting Pipeline.
 */
export default function OwnerDashboardRedirect() {
  redirect("/admin/lead-engine");
}
