import { redirect } from "next/navigation";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth/session";
import { AIBusinessDashboard } from "@/components/admin/ai-business-dashboard";

export const metadata = {
  title: "AI Business Center - Twin Mile Admin",
  robots: { index: false, follow: false },
};

export default async function LeadEnginePage() {
  const user = await requireRole("admin");
  if (!user) return null;

  const client = await clientPromise!;
  const db = client.db();

  // Fetch real data from database
  const [quoteLeads, driverLeads] = await Promise.all([
    db
      .collection("leads_quotes")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 100 })
      .toArray(),
    db
      .collection("leads_drivers")
      .find({ isArchived: { $ne: true } }, { sort: { createdAt: -1 }, limit: 100 })
      .toArray(),
  ]);

  // Handle AI business actions
  async function handleAIAction(action: string) {
    console.log(`🤖 AI Business Action Triggered: ${action}`);
    
    switch (action) {
      case 'find_customers':
        // Trigger autonomous lead generation
        console.log('🎯 Activating lead generation system...');
        break;
      case 'send_marketing':
        // Launch marketing campaigns
        console.log('📢 Launching marketing campaigns...');
        break;
      case 'check_revenue':
        // Generate financial report
        console.log('💰 Generating revenue report...');
        break;
      case 'hire_drivers':
        // Start recruitment process
        console.log('👥 Initiating driver recruitment...');
        break;
      case 'schedule_deliveries':
        // Optimize delivery routes
        console.log('🚚 Optimizing delivery schedules...');
        break;
      case 'customer_support':
        // Review customer satisfaction
        console.log('😊 Checking customer satisfaction...');
        break;
      case 'emergency_call':
        // Trigger emergency support
        console.log('🚨 Emergency support requested...');
        break;
      case 'emergency_email':
        // Send support email
        console.log('📧 Support email requested...');
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  }

  return (
    <main>
      <section className="border-b border-border/60">
        <div className="w-full py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">🤖 AI Business Center</h1>
              <div className="mt-2 text-sm text-muted-foreground">
                Your AI team is working 24/7 to grow your business - Monitor and control everything from here
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Real-time AI operations</div>
          </div>
        </div>
      </section>

      <section>
        <div className="w-full py-6">
          <AIBusinessDashboard onActionClick={handleAIAction} />
        </div>
      </section>
    </main>
  );
}
