// auto-onboarding-invite.mjs — runs every 2 hrs 8AM-8PM
// Moves qualified prospects (status "reviewed", aiScore >= 75) into onboarding
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const MONGODB_URI = envContent.match(/MONGODB_URI=(.+)/)?.[1]?.trim();

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not found in .env.local');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db();

console.log(`Connected to MongoDB: ${client.db().databaseName}`);

// Step 1: Query qualified prospects
const qualifiedProspects = await db.collection('outbound_prospects').find({
  status: 'reviewed',
  aiScore: { $gte: 75 }
}).limit(50).toArray();

console.log(`Found ${qualifiedProspects.length} qualified prospects (status: reviewed, aiScore >= 75)`);

let sessionsCreated = 0;
let tasksCreated = 0;
let skipped = 0;
const processedIds = [];

for (const prospect of qualifiedProspects) {
  // Validate email exists and is not empty
  const email = prospect.contact?.email;
  if (!email || email.trim() === '') {
    console.log(`  SKIP: ${prospect.name} — no valid email`);
    skipped++;
    continue;
  }

  // Check if prospect already has an onboarding session
  const existingSession = await db.collection('onboarding_sessions').findOne({
    email: email,
    leadType: 'outbound_prospect'
  });

  if (existingSession) {
    console.log(`  SKIP: ${prospect.name} (${email}) — already has session`);
    skipped++;
    continue;
  }

  // Step 3a: Create onboarding session
  const rawToken = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessionDoc = {
    name: prospect.name,
    email: email,
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

  const sessionResult = await db.collection('onboarding_sessions').insertOne(sessionDoc);
  console.log(`  SESSION CREATED: ${prospect.name} (${email}) — token: ${rawToken.slice(0, 8)}...`);
  sessionsCreated++;

  // Step 3b: Create outreach task
  const priority = prospect.aiScore >= 85 ? 'urgent' : 'high';
  const state = prospect.location?.split(',')[1]?.trim() || '';

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
  console.log(`  TASK CREATED: ${prospect.name} — priority: ${priority}`);
  tasksCreated++;

  // Step 3c: Update prospect status to "onboarding_invited"
  await db.collection('outbound_prospects').updateOne(
    { _id: prospect._id },
    { $set: { status: 'onboarding_invited', updatedAt: now } }
  );
  console.log(`  PROSPECT UPDATED: ${prospect.name} → status: onboarding_invited`);

  processedIds.push(prospect._id);
}

// Step 4: Log to agent_activity
const activityLog = {
  timestamp: new Date(),
  agent: { name: 'Auto Onboarding Processor', role: 'Onboarding', department: 'Operations' },
  action: 'auto_onboarding_invite',
  result: {
    qualifiedProspects: qualifiedProspects.length,
    sessionsCreated: sessionsCreated,
    tasksCreated: tasksCreated,
    skipped: skipped
  },
  success: true
};

await db.collection('agent_activity').insertOne(activityLog);
console.log(`\nActivity logged to agent_activity`);

// Summary
console.log('\n=== AUTO ONBOARDING SUMMARY ===');
console.log(`Qualified prospects found: ${qualifiedProspects.length}`);
console.log(`Sessions created: ${sessionsCreated}`);
console.log(`Outreach tasks created: ${tasksCreated}`);
console.log(`Skipped (no email / already has session): ${skipped}`);
console.log(`================================`);

await client.close();
console.log('Done. Connection closed.');
