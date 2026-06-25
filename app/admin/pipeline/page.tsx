import { PipelineFlowDashboard } from "@/components/admin/pipeline-flow-dashboard";
import { getPipelineFunnelData } from "@/lib/admin-pipeline-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Pipeline Flow | Twin Mile Admin",
};

export default async function PipelineFlowPage() {
  // Normalize MongoDB objects/Date/ObjectId nested in activity results before
  // passing into the client component. Server Components require plain data.
  const data = JSON.parse(JSON.stringify(await getPipelineFunnelData()));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <PipelineFlowDashboard initialData={data} />
    </main>
  );
}
