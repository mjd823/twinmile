require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    connectTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
  });

  try {
    await client.connect();
    const db = client.db();

    // 1. Get all outreach_tasks leadIds (set-difference approach, not status filtering)
    const existingTasks = await db.collection('outreach_tasks').find({}, { projection: { leadId: 1 } }).toArray();
    const taskLeadIds = new Set(existingTasks.map(t => t.leadId?.toString()).filter(Boolean));
    console.log(`Existing outreach_tasks leadIds: ${taskLeadIds.size}`);

    // 2. Get all prospects with email (check both contact.email and top-level email)
    const prospects = await db.collection('outbound_prospects').find({
      $or: [
        { 'contact.email': { $exists: true, $ne: null, $ne: '' } },
        { email: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).toArray();
    console.log(`Prospects with email: ${prospects.length}`);

    // 3. Filter out prospects that already have tasks (set-difference)
    const prospectsNeedingTasks = prospects.filter(p => !taskLeadIds.has(p._id.toString()));
    console.log(`Prospects without outreach_tasks: ${prospectsNeedingTasks.length}`);

    if (prospectsNeedingTasks.length === 0) {
      console.log('✅ All prospects already have outreach tasks. Nothing to seed.');
      await client.close();
      process.exit(0);
      return;
    }

    // 4. Create outreach_tasks for the gap prospects
    const now = new Date();
    const tasksToInsert = prospectsNeedingTasks.map(p => {
      const email = p.contact?.email || p.email;
      const name = p.companyName || p.legalName || p.name || 'Unknown';
      return {
        leadId: p._id,
        leadType: 'outbound_prospect',
        template: 'prospect_outreach',
        channel: 'email',
        status: 'pending',
        priority: 'medium',
        attempts: 0,
        scheduledAt: now, // Due immediately
        personalization: {
          name: name,
          email: email,
          company: p.companyName || p.legalName || null,
          dotNumber: p.dotNumber || null,
          mcNumber: p.mcNumber || null,
        },
        createdAt: now,
        updatedAt: now,
      };
    });

    const result = await db.collection('outreach_tasks').insertMany(tasksToInsert);
    console.log(`\n✅ Seeded ${result.insertedCount} new prospect_outreach tasks`);
    console.log(`   Templates: prospect_outreach, Priority: medium, scheduledAt: now (due immediately)`);

    // Log to agent_activity
    await db.collection('agent_activity').insertOne({
      createdAt: now,
      agent: { name: 'Outreach Cron', role: 'Outreach Processor', department: 'Sales' },
      activity: `Seeded ${result.insertedCount} prospect_outreach tasks from outbound_prospects (set-difference seeding)`,
      action: 'outreach_seeding', type: 'outreach_cron_seeding',
      details: {
        prospectsTotal: prospects.length,
        prospectsWithoutTasks: prospectsNeedingTasks.length,
        tasksSeeded: result.insertedCount,
      },
      success: true,
    });
    console.log(`   Logged to agent_activity`);

    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    console.error(err.stack);
    await client.close().catch(() => {});
    process.exit(1);
  }
}

main();