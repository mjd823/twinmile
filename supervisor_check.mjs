import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  // 1. Check outbound_prospects overview
  const total = await db.collection('outbound_prospects').countDocuments();
  const qualified = await db.collection('outbound_prospects').countDocuments({ aiScore: { $gte: 75 }, status: { $in: ['reviewed', 'onboarding_invited'] } });
  const onboardingInvited = await db.collection('outbound_prospects').countDocuments({ status: 'onboarding_invited' });
  const onboardingStarted = await db.collection('outbound_prospects').countDocuments({ status: { $in: ['started', 'documents_submitted', 'lease_pending', 'dispatch_ready'] } });
  const newProspects = await db.collection('outbound_prospects').countDocuments({ status: 'new' });
  const reviewed = await db.collection('outbound_prospects').countDocuments({ status: 'reviewed' });
  
  // 2. Unscored prospects
  const unscored = await db.collection('outbound_prospects').find({ $or: [{ aiScore: { $exists: false } }, { aiScore: null }] }).toArray();
  
  // 3. Prospects with aiScore
  const scored = await db.collection('outbound_prospects').countDocuments({ aiScore: { $exists: true, $ne: null } });
  
  // 4. Cold call queue
  const coldCall = await db.collection('outbound_prospects').find({
    aiScore: { $gte: 60 },
    'contact.phone': { $exists: true, $ne: null },
    $or: [{ 'contact.email': { $exists: false } }, { 'contact.email': null }, { status: 'no_email' }]
  }).toArray();
  
  // 5. Onboarding sessions
  const onboardingSessions = await db.collection('onboarding_sessions').countDocuments();
  const pendingOnboarding = await db.collection('onboarding_sessions').countDocuments({ status: 'pending' });
  const startedOnboarding = await db.collection('onboarding_sessions').countDocuments({ status: 'started' });
  const completedOnboarding = await db.collection('onboarding_sessions').countDocuments({ status: 'completed' });
  
  // 6. Outreach tasks
  const pendingOutreach = await db.collection('outreach_tasks').countDocuments({ status: 'pending' });
  const sentOutreach = await db.collection('outreach_tasks').countDocuments({ status: 'sent' });
  const failedOutreach = await db.collection('outreach_tasks').countDocuments({ status: 'failed' });
  
  // 7. Agent activity today
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayActivity = await db.collection('agent_activity').find({ createdAt: { $gte: today } }).sort({ createdAt: -1 }).limit(30).toArray();
  
  // 8. Recent agent activity (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentActivity = await db.collection('agent_activity').find({ createdAt: { $gte: weekAgo } }).sort({ createdAt: -1 }).limit(40).toArray();
  
  // 9. Failed activities
  const failedActivities = await db.collection('agent_activity').find({ success: false, createdAt: { $gte: weekAgo } }).toArray();
  
  // 10. Suggestions in recent activity
  const suggestions = await db.collection('agent_activity').find({
    createdAt: { $gte: weekAgo },
    $or: [
      { result: { $regex: /suggest|recommend|proposal/i } },
      { details: { $regex: /suggest|recommend|proposal/i } }
    ]
  }).toArray();
  
  // 11. Prospects created today
  const todayProspects = await db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: today } });
  
  // 12. Prospects by status distribution
  const statusDist = await db.collection('outbound_prospects').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  
  // 13. Prospects by score range
  const scoreRanges = [
    { _id: '90-100', min: 90, max: 101 },
    { _id: '80-89', min: 80, max: 90 },
    { _id: '75-79', min: 75, max: 80 },
    { _id: '60-74', min: 60, max: 75 },
    { _id: '40-59', min: 40, max: 60 },
    { _id: '0-39', min: 0, max: 40 }
  ];
  const allScored = await db.collection('outbound_prospects').find({ aiScore: { $exists: true, $ne: null } }).toArray();
  const scoreDist = scoreRanges.map(r => ({
    _id: r._id,
    count: allScored.filter(p => p.aiScore >= r.min && p.aiScore < r.max).length
  }));

  console.log('=== PIPELINE HEALTH ===');
  console.log('Total prospects:', total);
  console.log('New:', newProspects, '| Reviewed:', reviewed);
  console.log('Qualified (aiScore>=75):', qualified);
  console.log('Onboarding Invited:', onboardingInvited);
  console.log('Onboarding Started+:', onboardingStarted);
  console.log('Scored:', scored, '| Unscored:', unscored.length);
  console.log('Cold call queue:', coldCall.length);
  console.log('New prospects today:', todayProspects);
  console.log('');
  console.log('=== STATUS DISTRIBUTION ===');
  for (const s of statusDist) {
    console.log('  ', s._id || '(none)', ':', s.count);
  }
  console.log('');
  console.log('=== SCORE DISTRIBUTION ===');
  for (const s of scoreDist) {
    console.log('  ', s._id, ':', s.count);
  }
  console.log('');
  console.log('=== ONBOARDING ===');
  console.log('Total sessions:', onboardingSessions, '| Pending:', pendingOnboarding, '| Started:', startedOnboarding, '| Completed:', completedOnboarding);
  console.log('');
  console.log('=== OUTREACH ===');
  console.log('Pending tasks:', pendingOutreach, '| Sent:', sentOutreach, '| Failed:', failedOutreach);
  console.log('');
  console.log('=== UNSCORED PROSPECTS ===');
  for (const p of unscored) {
    console.log('  -', p.companyName || p.contact?.name || 'Unknown',
      '| DOT:', p.dotNumber || p.fmcsa?.dotNumber || 'N/A',
      '| Status:', p.status,
      '| Fleet:', p.fleetSize || p.fmcsa?.powerUnits || 'N/A',
      '| State:', p.contact?.state || p.state || 'N/A');
  }
  console.log('');
  console.log('=== COLD CALL QUEUE ===');
  for (const p of coldCall) {
    console.log('  -', p.companyName || 'Unknown', '| Phone:', p.contact?.phone, '| Score:', p.aiScore);
  }
  console.log('');
  console.log('=== TODAY ACTIVITY ===');
  for (const a of todayActivity) {
    const agentName = typeof a.agent === 'string' ? a.agent : (a.agent?.name || 'Unknown');
    const action = a.action || a.type || 'unknown';
    const time = new Date(a.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' });
    console.log('  [' + time + ']', agentName, '-', action, '| success:', a.success);
  }
  console.log('');
  console.log('=== RECENT ACTIVITY (7d) ===');
  for (const a of recentActivity) {
    const agentName = typeof a.agent === 'string' ? a.agent : (a.agent?.name || 'Unknown');
    const action = a.action || a.type || 'unknown';
    const time = new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log('  [' + time + ']', agentName, '-', action, '| success:', a.success);
  }
  console.log('');
  console.log('=== FAILED ACTIVITIES (7d) ===');
  for (const a of failedActivities) {
    const agentName = typeof a.agent === 'string' ? a.agent : (a.agent?.name || 'Unknown');
    const action = a.action || a.type || 'unknown';
    const time = new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    console.log('  [' + time + ']', agentName, '-', action, '|', JSON.stringify(a.result || a.error || 'no details'));
  }
  console.log('');
  console.log('=== SUGGESTIONS (7d) ===');
  for (const a of suggestions) {
    const agentName = typeof a.agent === 'string' ? a.agent : (a.agent?.name || 'Unknown');
    const time = new Date(a.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    const text = typeof a.result === 'string' ? a.result : JSON.stringify(a.result || a.details || '');
    console.log('  [' + time + ']', agentName, ':', text.substring(0, 200));
  }
  
  await client.close();
}
check().catch(console.error);
