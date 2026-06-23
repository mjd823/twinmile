import { AgentsDashboard } from "@/components/admin/agents-dashboard";

export const metadata = {
  title: "AI Agents | Twin Mile Admin",
};

export default function AgentsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <AgentsDashboard />
    </main>
  );
}