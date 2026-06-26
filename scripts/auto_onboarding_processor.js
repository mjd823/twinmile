// Auto Onboarding Processor — Twin Mile LLC
// Runs every 2 hours (8am-8pm). Moves qualified prospects into onboarding.
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');

  const prospectsCol = db.collection('outbound_prospects');
  const sessionsCol = db.collection('onboarding_sessions');
  const outreachCol = db.collection('outreach_tasks');
  const activityCol = db.collection('agent_activity');

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // Step 1: Query qualified prospects — status "reviewed" AND aiScore >= 75
  const qualifiedProspects = await prospectsCol.find({
    status: 'reviewed',
    aiScore: { $gte: 75 }
  }).limit(50).toArray();

  console.log(`Found ${qualifiedProspects.length} qualified prospects (status=reviewed, aiScore>=75)`);

  let sessionsCreated = 0;
  let tasksCreated = 0;
  let skipped = 0;
  const processedIds = [];

  for (const prospect of qualifiedProspects) {
    // Validate email
    const email = prospect.contact?.email;
    if (!email || email.trim() === '') {
      console.log(`  SKIP: ${prospect.name} — no valid email`);
      skipped++;
      continue;
    }

    // Step 2: Check if onboarding session already exists for this email
    const existingSession = await sessionsCol.findOne({ email: email.trim() });
    if (existingSession) {
      console.log(`  SKIP: ${prospect.name} — onboarding session already exists (${existingSession.status})`);
      skipped++;
      continue;
    }

    // Step 3a: Create onboarding session
    const rawToken = require('crypto').randomUUID();
    const expiresAt = new Date(now.getTime() + sevenDaysMs);
    const sessionDoc = {
      name: prospect.name,
      email: email.trim(),
      leadType: 'outbound_prospect',
      status: 'pending',
      rawToken: rawToken,
      expiresAt: expiresAt,
      metadata: {
        aiScore: prospect.aiScore,
        source: prospect.source,
        phone: prospect.contact?.phone || null
      },
      createdAt: now
    };

    const sessionResult = await sessionsCol.insertOne(sessionDoc);
    console.log(`  SESSION CREATED: ${prospect.name} (${email}) — session ID: ${sessionResult.insertedId}`);
    sessionsCreated++;

    // Step 3b: Create outreach task
    const state = prospect.location?.split(',')[1]?.trim() || '';
    const outreachDoc = {
      leadId: prospect._id,
      leadType: 'outbound_prospect',
      leadEmail: email.trim(),
      leadName: prospect.name,
      template: 'prospect_outreach',
      channel: 'email',
      priority: prospect.aiScore >= 85 ? 'urgent' : 'high',
      scheduledAt: now,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      personalization: {
        name: prospect.name,
        state: state
      },
      createdAt: now
    };

    const outreachResult = await outreachCol.insertOne(outreachDoc);
    console.log(`  OUTREACH TASK CREATED: ${prospect.name} — priority: ${outreachDoc.priority} — task ID: ${outreachResult.insertedId}`);
    tasksCreated++;

    // Step 3c: Update prospect status to "onboarding_invited"
    await prospectsCol.updateOne(
      { _id: prospect._id },
      { $set: { status: 'onboarding_invited', updatedAt: now } }
    );
    processedIds.push(prospect._id);
  }

  // Step 4: Log to agent_activity
  const activityDoc = {
    agent: {
      name: 'Auto Onboarding Processor',
      role: 'Onboarding',
      department: 'Operations'
    },
    action: 'auto_onboarding_invite',
    result: {
      qualifiedProspects: qualifiedProspects.length,
      sessionsCreated: sessionsCreated,
      tasksCreated: tasksCreated,
      skipped: skipped
    },
    success: true,
    createdAt: now,
    timestamp: now
  };

  await activityCol.insertOne(activityDoc);

  console.log('\n=== AUTO ONBOARDING PROCESSOR SUMMARY ===');
  console.log(`Qualified prospects found: ${qualifiedProspects.length}`);
  console.log(`Sessions created:          ${sessionsCreated}`);
  console.log(`Outreach tasks created:    ${tasksCreated}`);
  console.log(`Skipped:                   ${skipped}`);
  console.log(`Processed prospect IDs:    ${processedIds.length}`);
  console.log('=========================================');

  await client.close();
  console.log('Done. Connection closed.');
})().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
