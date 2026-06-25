import { requireRole } from "@/lib/auth/session";
import { PipelineFlowDashboard } from "@/components/admin/pipeline-flow-dashboard";
import { getPipelineFunnelData } from "@/lib/admin-pipeline-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Pipeline Flow | Twin Mile Admin",
};

export default async function PipelineFlowPage() {
  const user = await requireRole("admin");
  if (!user) return null;

  let data;
  try {
    // Normalize MongoDB objects/Date/ObjectId nested in activity results before
    // passing into the client component. Server Components require plain data.
    data = JSON.parse(JSON.stringify(await getPipelineFunnelData()));
  } catch (error) {
    console.error("[pipeline-flow-page] Failed to load pipeline data:", error);
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-6">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-400">Pipeline data unavailable</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Could not connect to the database. Please try refreshing. If the problem persists, check that MONGODB_URI is configured.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <PipelineFlowDashboard initialData={data} />
    </main>
  );
}
