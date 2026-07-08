import { requireRole } from "@/lib/auth/session";
import { getOutreachDashboardData } from "@/lib/outreach-data";
import { OutreachDashboard } from "@/components/admin/outreach-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Outreach | Twin Mile Admin",
};

export default async function OutreachPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  let data;
  try {
    data = JSON.parse(JSON.stringify(await getOutreachDashboardData()));
  } catch (error) {
    console.error("[outreach-page] Failed to load outreach data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-400">Outreach data unavailable</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Could not connect to the database. Please try refreshing.
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">{message.substring(0, 200)}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <OutreachDashboard initialData={data} />
    </main>
  );
}
