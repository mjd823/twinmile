const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const prospectsCollection = db.collection('outbound_prospects');
  const tasksCollection = db.collection('outreach_tasks');

  // Get all leadIds that already have tasks
  const taskLeadIds = await tasksCollection.distinct('leadId');

  // Find prospects with email but no task
  const prospectsWithoutTasks = await prospectsCollection.find({
    $and: [
      {
        $or: [
          { 'contact.email': { $exists: true, $ne: null, $ne: '' } },
          { email: { $exists: true, $ne: null, $ne: '' } }
        ]
      },
      { _id: { $nin: taskLeadIds } }
    ]
  }).toArray();

  if (prospectsWithoutTasks.length === 0) {
    console.log('No seeding needed. All prospects with email already have tasks.');
    await client.close();
    return;
  }

  console.log('Seeding ' + prospectsWithoutTasks.length + ' outreach task(s)...');

  const now = new Date();
  const tasksToInsert = prospectsWithoutTasks.map(p => {
    const email = (p.contact && p.contact.email) || p.email;
    const name = p.companyName || p.legalName || p.name || 'Unknown';
    const phone = p.phone || (p.contact && p.contact.phone) || null;

    return {
      leadId: p._id,
      leadType: 'prospect',
      template: 'prospect_outreach',
      channel: 'email',
      priority: 'medium',
      status: 'pending',
      scheduledAt: now,
      attempts: 0,
      personalization: {
        name: name,
        email: email,
        phone: phone,
        companyName: p.companyName || p.legalName || p.name || null
      },
      createdAt: now,
      updatedAt: now
    };
  });

  const result = await tasksCollection.insertMany(tasksToInsert);
  console.log('✅ Inserted ' + result.insertedCount + ' outreach task(s)');

  // Log to agent_activity
  await db.collection('agent_activity').insertOne({
    createdAt: now,
    agent: { name: 'Outreach Seeder', role: 'Outreach Processor', department: 'Sales' },
    activity: 'Seeded ' + result.insertedCount + ' outreach tasks from outbound_prospects (prospects with email but no existing task)',
    action: 'outreach_seeding',
    type: 'outreach_cron',
    details: {
      tasksSeeded: result.insertedCount,
      prospectIds: prospectsWithoutTasks.map(p => p._id.toString()),
      runTime: now.toISOString()
    },
    success: true
  });
  console.log('📝 Logged seeding activity to agent_activity');

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
