import { redirect } from "next/navigation";

/**
 * /admin/dashboard/recruiting was a limit-100 shadow of the Recruiting
 * Pipeline — merged into /admin/lead-engine.
 */
export default function RecruitingDashboardRedirect() {
  redirect("/admin/lead-engine");
}
