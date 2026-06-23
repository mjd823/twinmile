import { CronMonitorDashboard } from "@/components/admin/cron-monitor-dashboard";

export const metadata = {
  title: "Automation Command Center | Twin Mile Admin",
};

export default function CronMonitorPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6">
      <CronMonitorDashboard />
    </main>
  );
}