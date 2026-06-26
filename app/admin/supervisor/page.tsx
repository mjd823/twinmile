import { SupervisorDashboard } from "@/components/admin/supervisor-dashboard";
import { SupervisorChat } from "@/components/admin/supervisor-chat";

export const metadata = {
  title: "AI Supervisor Dashboard | Twin Mile Admin",
};

export default function SupervisorPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupervisorDashboard />
        <SupervisorChat />
      </div>
    </main>
  );
}
