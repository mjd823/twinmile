import { AgentTimesheet } from "@/components/admin/agent-timesheet";

export const metadata = {
  title: "Agent Timesheet | Twin Mile Admin",
};

export default function TimesheetPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-6">
      <AgentTimesheet />
    </main>
  );
}