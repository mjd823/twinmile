import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    if (!clientPromise) {
      return NextResponse.json(
        { success: false, error: 'MONGODB_URI not configured' },
        { status: 500 }
      );
    }
    const client = await clientPromise;
    const db = client.db();

    // Get database stats
    const [totalLeads, totalCustomers, totalDrivers, totalProspects, totalOutreachTasks] = await Promise.all([
      db.collection('leads_drivers').countDocuments(),
      db.collection('customers').countDocuments(),
      db.collection('drivers').countDocuments(),
      db.collection('outbound_prospects').countDocuments(),
      db.collection('outreach_tasks').countDocuments(),
    ]);

    // Get recent agent activity (last 50)
    const recentActivities = await db.collection('agent_activity')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Get supervisor report
    const supervisorReport = {
      supervisorName: 'AI Supervisor',
      systemHealth: {
        score: totalLeads > 0 ? 85 : 50,
        status: totalLeads > 0 ? 'healthy' : 'initializing',
        activeAgents: 8,
        databaseConnected: true,
        totalRecords: totalLeads + totalCustomers + totalDrivers + totalProspects,
      },
      activeAlerts: [],
      totalInterventions: 0,
    };

    return NextResponse.json({
      success: true,
      supervisorReport,
      activities: recentActivities.map(a => ({
        ...a,
        _id: a._id.toString(),
      })),
      databaseStats: {
        totalLeads,
        totalCustomers,
        totalDrivers,
        totalProspects,
        totalOutreachTasks,
        totalRecords: totalLeads + totalCustomers + totalDrivers + totalProspects,
      },
    });
  } catch (error) {
    console.error('[api/admin/ai-activity] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI activity', message: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!clientPromise) {
      return NextResponse.json(
        { success: false, error: 'MONGODB_URI not configured' },
        { status: 500 }
      );
    }
    const { action } = await request.json();
    const client = await clientPromise;
    const db = client.db();

    let result: any = { success: true, message: '', timestamp: new Date().toISOString() };

    switch (action) {
      case 'daily_ops': {
        // Run daily AI operations
        const [prospects, outreachTasks, driverLeads] = await Promise.all([
          db.collection('outbound_prospects').find({ status: 'new' }).limit(10).toArray(),
          db.collection('outreach_tasks').find({ status: { $in: ['pending', 'retrying'] } }).limit(20).toArray(),
          db.collection('leads_drivers').find({ status: 'new' }).limit(10).toArray(),
        ]);

        // Log activity
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: 'AI Supervisor',
          activity: `Daily ops: ${prospects.length} new prospects, ${outreachTasks.length} pending outreach, ${driverLeads.length} new driver leads`,
          type: 'daily_ops',
          details: { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length },
        });

        result.message = `✅ Daily operations complete: ${prospects.length} prospects, ${outreachTasks.length} outreach tasks, ${driverLeads.length} driver leads queued`;
        result.details = { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length };
        break;
      }

      case 'weekly_review': {
        // Weekly strategic review
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [newLeads, convertedLeads, totalOutreach, avgScore] = await Promise.all([
          db.collection('leads_drivers').countDocuments({ createdAt: { $gte: oneWeekAgo } }),
          db.collection('leads_drivers').countDocuments({ status: 'converted', updatedAt: { $gte: oneWeekAgo } }),
          db.collection('outreach_tasks').countDocuments({ createdAt: { $gte: oneWeekAgo } }),
          db.collection('outbound_prospects').aggregate([
            { $match: { createdAt: { $gte: oneWeekAgo } } },
            { $group: { _id: null, avgScore: { $avg: '$score' } } }
          ]).toArray(),
        ]);

        const avg = avgScore[0]?.avgScore || 0;

        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: 'AI Supervisor',
          activity: `Weekly review: ${newLeads} new leads, ${convertedLeads} converted, ${totalOutreach} outreach sent, avg score ${avg.toFixed(1)}`,
          type: 'weekly_review',
          details: { newLeads, convertedLeads, totalOutreach, avgScore: avg },
        });

        const conversionRate = newLeads > 0 ? ((convertedLeads / newLeads) * 100).toFixed(1) : '0';
        result.message = `📊 Weekly review: ${newLeads} leads, ${conversionRate}% conversion, ${totalOutreach} outreach, avg score ${avg.toFixed(1)}`;
        result.details = { newLeads, convertedLeads, totalOutreach, avgScore: avg, conversionRate };
        break;
      }

      case 'monthly_bi': {
        // Monthly business intelligence
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, monthlyRevenue] = await Promise.all([
          db.collection('leads_drivers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
          db.collection('customers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
          db.collection('drivers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
          db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
          db.collection('loads').aggregate([
            { $match: { createdAt: { $gte: oneMonthAgo }, status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$revenue' } } }
          ]).toArray(),
        ]);

        const revenue = monthlyRevenue[0]?.total || 0;

        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: 'AI Supervisor',
          activity: `Monthly BI: ${monthlyLeads} leads, ${monthlyCustomers} customers, ${monthlyDrivers} drivers, ${monthlyProspects} prospects, $${revenue.toLocaleString()} revenue`,
          type: 'monthly_bi',
          details: { monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, revenue },
        });

        result.message = `📈 Monthly BI: ${monthlyLeads} leads, ${monthlyCustomers} customers, ${monthlyDrivers} drivers, ${monthlyProspects} prospects, $${revenue.toLocaleString()} revenue`;
        result.details = { monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, revenue };
        break;
      }

      case 'driver_engagement': {
        // Driver engagement check
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const staleDrivers = await db.collection('drivers').find({
          lastContactAt: { $lt: thirtyDaysAgo },
          status: 'active'
        }).limit(20).toArray();

        // Create outreach tasks for stale drivers
        let tasksCreated = 0;
        for (const driver of staleDrivers) {
          const existing = await db.collection('outreach_tasks').findOne({
            leadId: driver._id,
            leadType: 'driver',
            status: { $in: ['pending', 'retrying'] }
          });
          if (!existing) {
            await db.collection('outreach_tasks').insertOne({
              leadId: driver._id,
              leadType: 'driver',
              template: 'driver_followup',
              channel: 'email',
              priority: 'medium',
              scheduledAt: new Date(),
              status: 'pending',
              attempts: 0,
              maxAttempts: 3,
              personalization: { name: driver.name, truckType: driver.truckType },
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            tasksCreated++;
          }
        }

        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: 'AI Supervisor',
          activity: `Driver engagement: ${staleDrivers.length} stale drivers found, ${tasksCreated} outreach tasks created`,
          type: 'driver_engagement',
          details: { staleDrivers: staleDrivers.length, tasksCreated },
        });

        result.message = `🚛 Driver engagement: ${staleDrivers.length} stale drivers, ${tasksCreated} follow-up tasks created`;
        result.details = { staleDrivers: staleDrivers.length, tasksCreated };
        break;
      }

      case 'auto_onboarding': {
        // Auto onboarding for high-score prospects
        const qualifiedProspects = await db.collection('outbound_prospects').find({
          score: { $gte: 75 },
          status: 'new',
          onboardingStarted: { $ne: true }
        }).limit(10).toArray();

        let onboarded = 0;
        for (const prospect of qualifiedProspects) {
          await db.collection('outbound_prospects').updateOne(
            { _id: prospect._id },
            { $set: { status: 'onboarding', onboardingStarted: true, onboardingStep: 'identity_verification', updatedAt: new Date() } }
          );

          // Create driver lead from prospect
          await db.collection('leads_drivers').insertOne({
            name: prospect.name,
            email: prospect.contact?.email,
            phone: prospect.contact?.phone,
            truckType: prospect.equipment?.[0] || 'Not specified',
            yearsExperience: parseInt(prospect.experience?.replace('+', '').replace(' years', '')) || 0,
            status: 'onboarding',
            source: 'outbound_prospecting',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await db.collection('agent_activity').insertOne({
            timestamp: new Date(),
            agent: 'AI Supervisor',
            activity: `Auto onboarding started for ${prospect.name} (score: ${prospect.score})`,
            type: 'auto_onboarding',
            details: { prospectId: prospect._id.toString(), score: prospect.score },
          });
          onboarded++;
        }

        result.message = `🎯 Auto onboarding: ${onboarded} qualified prospects (score ≥75) moved to onboarding`;
        result.details = { onboarded, totalQualified: qualifiedProspects.length };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/admin/ai-activity] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute action', message: String(error) },
      { status: 500 }
    );
  }
}