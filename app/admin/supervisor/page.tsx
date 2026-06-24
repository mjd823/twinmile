import { SupervisorDashboard } from "@/components/admin/supervisor-dashboard";

export const metadata = {
  title: "AI Supervisor Dashboard | Twin Mile Admin",
};

export default function SupervisorPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-6">
      <SupervisorDashboard />
    </main>
  );
}
