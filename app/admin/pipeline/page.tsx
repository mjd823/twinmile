import { PipelineFlowDashboard } from "@/components/admin/pipeline-flow-dashboard";

export const metadata = {
  title: "Pipeline Flow | Twin Mile Admin",
};

export default function PipelineFlowPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <PipelineFlowDashboard />
    </main>
  );
}