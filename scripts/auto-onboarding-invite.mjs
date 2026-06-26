import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'twinmile';
const MAX_PER_RUN = 50;

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('Connected to MongoDB');

  // Step 1: Query qualified prospects (status "reviewed" AND aiScore >= 75)
  const prospects = await db.collection('outbound_prospects')
    .find({
      status: 'reviewed',
      aiScore: { $gte: 75 }
    })
    .limit(MAX_PER_RUN)
    .toArray();

  console.log(`Found ${prospects.length} qualified prospects (status=reviewed, aiScore>=75)`);

  let sessionsCreated = 0;
  let tasksCreated = 0;
  let skipped = 0;
  const now = new Date();

  for (const prospect of prospects) {
    // Validate email
    const email = prospect.contact?.email;
    if (!email || email.trim() === '') {
      console.log(`  SKIP: ${prospect.name} — no valid email`);
      skipped++;
      continue;
    }

    // Step 2: Check if onboarding session already exists
    const existingSession = await db.collection('onboarding_sessions').findOne({
      email: email,
      leadType: 'outbound_prospect'
    });

    if (existingSession) {
      console.log(`  SKIP: ${prospect.name} — onboarding session already exists`);
      skipped++;
      continue;
    }

    // Step 3a: Create onboarding session
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rawToken = crypto.randomUUID();

    const sessionDoc = {
      name: prospect.name,
      email: email,
      leadType: 'outbound_prospect',
      status: 'pending',
      rawToken: rawToken,
      expiresAt: expiresAt,
      metadata: {
        aiScore: prospect.aiScore,
        source: prospect.source || '',
        phone: prospect.contact?.phone || ''
      },
      createdAt: now
    };

    const sessionResult = await db.collection('onboarding_sessions').insertOne(sessionDoc);
    sessionsCreated++;
    console.log(`  SESSION: Created onboarding session for ${prospect.name} (${email}), token=${rawToken.slice(0,8)}...`);

    // Step 3b: Create outreach task
    const state = prospect.location?.split(',')[1]?.trim() || '';
    const priority = prospect.aiScore >= 85 ? 'urgent' : 'high';

    const taskDoc = {
      leadId: prospect._id,
      leadType: 'outbound_prospect',
      leadEmail: email,
      leadName: prospect.name,
      template: 'prospect_outreach',
      channel: 'email',
      priority: priority,
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

    await db.collection('outreach_tasks').insertOne(taskDoc);
    tasksCreated++;
    console.log(`  TASK: Created outreach task for ${prospect.name}, priority=${priority}`);

    // Step 3c: Update prospect status to "onboarding_invited"
    await db.collection('outbound_prospects').updateOne(
      { _id: prospect._id },
      { $set: { status: 'onboarding_invited', updatedAt: now } }
    );
    console.log(`  STATUS: Updated ${prospect.name} → onboarding_invited`);
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
      qualifiedProspects: prospects.length,
      sessionsCreated: sessionsCreated,
      tasksCreated: tasksCreated,
      skipped: skipped
    },
    success: true,
    createdAt: now,
    timestamp: now
  };

  await db.collection('agent_activity').insertOne(activityDoc);
  console.log(`\nActivity logged: ${sessionsCreated} sessions, ${tasksCreated} tasks, ${skipped} skipped`);

  await client.close();
  console.log('Done.');
}

run().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
