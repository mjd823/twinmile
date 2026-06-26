import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  // Check onboarding sessions detail
  const pendingSessions = await db.collection('onboarding_sessions').find({ status: 'pending' }).limit(5).toArray();
  const startedSessions = await db.collection('onboarding_sessions').find({ status: 'started' }).limit(5).toArray();
  
  // Check failed outreach tasks
  const failedOutreach = await db.collection('outreach_tasks').find({ status: 'failed' }).limit(10).toArray();
  
  // Check the one started session
  const theStarted = await db.collection('onboarding_sessions').findOne({ status: 'started' });
  
  // Check recent outreach tasks (last 20)
  const recentOutreach = await db.collection('outreach_tasks').find({}).sort({ createdAt: -1 }).limit(20).toArray();
  
  // Check agent_activity for unique agents in last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const allActivity = await db.collection('agent_activity').find({ createdAt: { $gte: weekAgo } }).toArray();
  const agentMap = {};
  for (const a of allActivity) {
    const name = typeof a.agent === 'string' ? a.agent : (a.agent?.name || 'Unknown');
    if (!agentMap[name]) agentMap[name] = { count: 0, lastActivity: a.createdAt };
    agentMap[name].count++;
    if (new Date(a.createdAt) > new Date(agentMap[name].lastActivity)) {
      agentMap[name].lastActivity = a.createdAt;
    }
  }
  const agentSummary = Object.entries(agentMap).map(([name, data]) => ({
    _id: name,
    count: data.count,
    lastActivity: data.lastActivity
  })).sort((a, b) => b.count - a.count);
  
  // Check if Sofia has been active
  const sofiaActivity = await db.collection('agent_activity').find({
    $or: [
      { agent: 'Sofia Rodriguez' },
      { 'agent.name': 'Sofia Rodriguez' }
    ],
    createdAt: { $gte: weekAgo }
  }).sort({ createdAt: -1 }).limit(5).toArray();
  
  // Check if Auto Onboarding ran recently
  const autoOnboarding = await db.collection('agent_activity').find({
    action: 'auto_onboarding_invite',
    createdAt: { $gte: weekAgo }
  }).sort({ createdAt: -1 }).limit(5).toArray();
  
  // Check prospects with onboarding_invited status - when were they invited
  const invitedProspects = await db.collection('outbound_prospects').find({ status: 'onboarding_invited' })
    .sort({ updatedAt: -1 }).limit(5).toArray();
  
  console.log('=== ONBOARDING DETAIL ===');
  console.log('Started session:', theStarted ? JSON.stringify({
    email: theStarted.email,
    status: theStarted.status,
    currentStep: theStarted.currentStep,
    firstClickedAt: theStarted.firstClickedAt,
    lastActiveAt: theStarted.lastActiveAt,
    createdAt: theStarted.createdAt
  }) : 'None');
  console.log('');
  console.log('Sample pending sessions:');
  for (const s of pendingSessions) {
    console.log('  -', s.email, '| token:', s.rawToken?.substring(0, 8) + '...', '| created:', s.createdAt);
  }
  console.log('');
  console.log('=== FAILED OUTREACH ===');
  for (const f of failedOutreach) {
    console.log('  -', f.recipientEmail || f.recipient, '| error:', f.error || f.result?.error || 'unknown', '| created:', f.createdAt);
  }
  console.log('');
  console.log('=== AGENT SUMMARY (7d) ===');
  for (const a of agentSummary) {
    const lastTime = new Date(a.lastActivity).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log('  ', a._id, ':', a.count, 'activities | last:', lastTime);
  }
  console.log('');
  console.log('=== SOFIA ACTIVITY (7d) ===');
  for (const a of sofiaActivity) {
    const time = new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log('  [' + time + ']', a.action || a.type, '|', JSON.stringify(a.result || '').substring(0, 100));
  }
  console.log('');
  console.log('=== AUTO ONBOARDING RUNS (7d) ===');
  for (const a of autoOnboarding) {
    const time = new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log('  [' + time + ']', a.action, '| success:', a.success, '|', JSON.stringify(a.result || '').substring(0, 100));
  }
  console.log('');
  console.log('=== RECENTLY INVITED PROSPECTS ===');
  for (const p of invitedProspects) {
    console.log('  -', p.companyName || 'Unknown', '| score:', p.aiScore, '| invited at:', p.updatedAt);
  }
  
  await client.close();
}
check().catch(console.error);
