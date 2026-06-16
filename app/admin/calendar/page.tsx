import { CalendarView, KanbanView } from '@/components/calendar/CalendarKanban';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'cron' | 'agent_action' | 'pipeline' | 'onboarding' | 'lease' | 'meeting';
  agentId?: string;
  details?: string;
  color: string;
}

const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  if (!clientPromise) return [];
  try {
    const client = await clientPromise;
    const db = client.db();

    const events: CalendarEvent[] = [];

    // Add cron job schedules (from your cron jobs)
    const cronEvents = [
      { id: 'cron-prospecting', title: '📊 Outbound Prospecting', time: '08:00', type: 'cron', color: 'bg-cyan-500/80' },
      { id: 'cron-ai-ops', title: '🤖 AI Ops Review', time: '07:00', type: 'cron', color: 'bg-purple-500/80' },
      { id: 'cron-engagement', title: '💬 Driver Engagement', time: '09:00', type: 'cron', color: 'bg-green-500/80' },
      { id: 'cron-outreach', title: '📬 Outreach Processing', time: 'Every 15min', type: 'cron', color: 'bg-blue-500/80' },
      { id: 'cron-onboarding', title: '🎯 Auto Onboarding', time: 'Every 2hr', type: 'cron', color: 'bg-orange-500/80' },
      { id: 'cron-weekly', title: '📊 Weekly Review (Mon)', time: '06:00', type: 'cron', color: 'bg-amber-500/80' },
      { id: 'cron-monthly', title: '📈 Monthly BI (1st)', time: '05:00', type: 'cron', color: 'bg-pink-500/80' },
    ];

    cronEvents.forEach(c => {
      events.push({
        id: c.id,
        title: c.title,
        date: new Date(),
        type: 'cron',
        details: `${c.time} - ${c.title}`,
        color: c.color,
      });
    });

    // Add recent agent activities
    const activities = await db.collection('agent_activity')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    activities.forEach(a => {
      if (a.timestamp) {
        events.push({
          id: `activity-${a._id}`,
          title: a.agent?.name || a.agent || 'System',
          date: new Date(a.timestamp),
          type: 'agent_action',
          details: a.activity || a.action,
          color: 'bg-primary/80',
        });
      }
    });

    // Add pipeline events (new leads, conversions)
    const [newQuotes, newDrivers, converted] = await Promise.all([
      db.collection('leads_quotes').find({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }).toArray(),
      db.collection('leads_drivers').find({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }).toArray(),
      db.collection('leads_quotes').find({ status: 'converted', convertedAt: { $gte: new Date(Date.now() - 7 * 86400000) } }).toArray(),
    ]);

    newQuotes.forEach(q => events.push({
      id: `quote-${q._id}`,
      title: `📦 New Quote: ${q.name || q.company}`,
      date: new Date(q.createdAt),
      type: 'pipeline',
      details: `${q.serviceType} - ${q.origin} → ${q.destination}`,
      color: 'bg-blue-500/80',
    }));

    newDrivers.forEach(d => events.push({
      id: `driver-${d._id}`,
      title: `🚛 New Driver: ${d.fullName || d.name}`,
      date: new Date(d.createdAt),
      type: 'onboarding',
      details: `${d.truckType} - ${d.yearsExperience} yrs exp`,
      color: 'bg-orange-500/80',
    }));

    converted.forEach(c => events.push({
      id: `converted-${c._id}`,
      title: `✅ Won: ${c.name || c.company}`,
      date: new Date(c.convertedAt || c.createdAt),
      type: 'pipeline',
      details: `Converted! $${c.estimatedValue || c.rate || 0}`,
      color: 'bg-green-500/80',
    }));

    return events;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
};

const getPipelineData = async () => {
  if (!clientPromise) return { quoteLeads: [], driverLeads: [], leaseAgreements: [] };
  try {
    const client = await clientPromise;
    const db = client.db();

    const [quoteLeads, driverLeads, leaseAgreements] = await Promise.all([
      db.collection('leads_quotes').find({}).toArray(),
      db.collection('leads_drivers').find({}).toArray(),
      db.collection('lease_agreements').find({}).toArray(),
    ]);

    return { quoteLeads, driverLeads, leaseAgreements };
  } catch {
    return { quoteLeads: [], driverLeads: [], leaseAgreements: [] };
  }
};

export default async function CalendarPage() {
  const [events, pipeline] = await Promise.all([getCalendarEvents(), getPipelineData()]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-blue-500 text-xl">📅</span>
            </span>
            Calendar & Kanban
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cron schedule • Agent activity • Pipeline visualization
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar - 2/3 width */}
        <div className="lg:col-span-2">
          <CalendarView events={events} />
        </div>

        {/* Upcoming Cron Jobs */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <span className="text-purple-500 text-xl">⚙️</span>
                </span>
                Upcoming Cron Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Outbound Prospecting', schedule: 'Daily 8:00 AM', agent: 'Sofia', status: 'active', color: 'bg-cyan-500' },
                { label: 'AI Ops Review', schedule: 'Daily 7:00 AM', agent: 'Alexandra', status: 'active', color: 'bg-purple-500' },
                { label: 'Driver Engagement', schedule: 'Daily 9:00 AM', agent: 'Jennifer', status: 'active', color: 'bg-green-500' },
                { label: 'Outreach Processing', schedule: 'Every 15 minutes', agent: 'Marcus', status: 'active', color: 'bg-blue-500' },
                { label: 'Auto Onboarding', schedule: 'Every 2 hours', agent: 'Jennifer', status: 'active', color: 'bg-orange-500' },
                { label: 'Weekly Strategic Review', schedule: 'Monday 6:00 AM', agent: 'Alexandra', status: 'active', color: 'bg-amber-500' },
                { label: 'Monthly Business Intelligence', schedule: '1st of month 5:00 AM', agent: 'Robert', status: 'active', color: 'bg-pink-500' },
              ].map((cron, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${cron.color}`} />
                    <div>
                      <p className="font-medium text-sm">{cron.label}</p>
                      <p className="text-xs text-muted-foreground">{cron.schedule} • {cron.agent}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${cron.status === 'active' ? 'bg-green-500/10 text-green-700 border-green-500/30' : 'bg-gray-500/10 text-gray-700 border-gray-500/30'}`}>
                    {cron.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kanban View - Full Width */}
      <div className="border-t border-border/60 pt-6">
        <KanbanView 
          quoteLeads={pipeline.quoteLeads} 
          driverLeads={pipeline.driverLeads} 
          leaseAgreements={pipeline.leaseAgreements}
        />
      </div>
    </div>
  );
}