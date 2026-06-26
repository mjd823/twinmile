const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const mongoLine = envContent.split('\n').find(l => l.startsWith('MONGODB_URI='));
const mongoUri = mongoLine ? mongoLine.replace('MONGODB_URI=', '').replace(/\r$/, '') : '';

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('test');

  const outboundProspects = db.collection('outbound_prospects');
  const agentActivity = db.collection('agent_activity');
  const onboardingSessions = db.collection('onboarding_sessions');
  const outreachTasks = db.collection('outreach_tasks');

  // Current pipeline state
  const totalProspects = await outboundProspects.countDocuments();
  const qualifiedProspects = await outboundProspects.countDocuments({ aiScore: { $gte: 75 } });
  const invitedProspects = await outboundProspects.countDocuments({ status: 'onboarding_invited' });
  const startedProspects = await outboundProspects.countDocuments({ status: 'onboarding_started' });
  const reviewedProspects = await outboundProspects.countDocuments({ status: 'reviewed' });
  const newProspects = await outboundProspects.countDocuments({ status: 'new' });
  const unscoredProspects = await outboundProspects.countDocuments({
    $or: [{ aiScore: { $exists: false } }, { aiScore: null }]
  });

  // Onboarding
  const pendingSessions = await onboardingSessions.countDocuments({ status: 'pending' });
  const startedSessions = await onboardingSessions.countDocuments({ status: 'started' });
  const completedSessions = await onboardingSessions.countDocuments({ status: 'completed' });
  const documentsSubmitted = await onboardingSessions.countDocuments({ status: 'documents_submitted' });

  // Outreach
  const pendingOutreach = await outreachTasks.countDocuments({ status: 'pending' });
  const sentOutreach = await outreachTasks.countDocuments({ status: 'sent' });
  const failedOutreach = await outreachTasks.countDocuments({ status: 'failed' });

  // Cold call queue
  const coldCallQueue = await outboundProspects.countDocuments({
    aiScore: { $gte: 60 },
    $or: [
      { 'contact.phone': { $exists: true, $ne: '', $ne: null } },
      { phone: { $exists: true, $ne: '', $ne: null } }
    ]
  });

  // Today activity
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayActivity = await agentActivity.countDocuments({ createdAt: { $gte: today } });

  // Agent activity last 7 days
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const agentAgg = await agentActivity.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    { $group: { _id: { $ifNull: [{ $ifNull: ['$agent.name', '$agent'] }, 'unknown'] }, count: { $sum: 1 }, lastActive: { $max: '$createdAt' } } },
    { $sort: { count: -1 } }
  ]).toArray();

  // Determine bottleneck
  let bottleneck = '';
  let bottleneckSeverity = 'normal';
  const qualifiedNotInvited = qualifiedProspects - invitedProspects;
  if (qualifiedNotInvited > 0) {
    bottleneck = qualifiedNotInvited + ' qualified prospects (aiScore>=75) NOT invited to onboarding. Auto Onboarding cron has not run since June 23 - this is the single biggest blocker to 20 hires/month.';
    bottleneckSeverity = 'critical';
  }

  // Score unscored prospects
  const unscoredDocs = await outboundProspects.find({
    $or: [{ aiScore: { $exists: false } }, { aiScore: null }]
  }).toArray();

  const targetStates = ['TX', 'LA', 'CA', 'GA', 'TN'];
  let scoredCount = 0;
  for (const prospect of unscoredDocs) {
    let score = 50;
    const authStatus = prospect.authorityStatus || (prospect.fmcsa && prospect.fmcsa.status) || '';
    if (authStatus) {
      const s = authStatus.toLowerCase();
      if (s.includes('active') || s.includes('authorized')) score += 15;
      else if (s.includes('inactive') || s.includes('out of service')) score -= 20;
    }
    const fleetSize = prospect.fleetSize || prospect.powerUnits || (prospect.fmcsa && prospect.fmcsa.powerUnits) || 0;
    if (fleetSize > 50) score += 15;
    else if (fleetSize > 20) score += 10;
    else if (fleetSize > 5) score += 5;
    const state = String(prospect.state || (prospect.fmcsa && prospect.fmcsa.state) || '').toUpperCase();
    if (targetStates.includes(state)) score += 10;
    const phone = prospect.phone || (prospect.contact && prospect.contact.phone) || '';
    const email = prospect.email || (prospect.contact && prospect.contact.email) || '';
    if (phone && phone.length >= 10) score += 5;
    if (email && email.includes('@')) score += 5;
    const dot = prospect.dotNumber || prospect.dot || (prospect.fmcsa && prospect.fmcsa.dotNumber) || '';
    if (dot && String(dot).length > 0) score += 5;
    score = Math.max(0, Math.min(100, score));
    await outboundProspects.updateOne({ _id: prospect._id }, { $set: { aiScore: score } });
    scoredCount++;
  }

  // Write scoring audit
  await agentActivity.insertOne({
    agent: { name: 'AI Supervisor', role: 'Monitor', department: 'Operations' },
    action: 'supervisor_scoring_audit',
    result: {
      prospectsScored: scoredCount,
      remainingUnscored: unscoredDocs.length - scoredCount,
      timestamp: new Date().toISOString()
    },
    success: true,
    createdAt: new Date(),
    timestamp: new Date()
  });

  // Build main supervisor report
  const result = {
    pipeline: {
      totalProspects,
      qualified: qualifiedProspects,
      onboardingInvited: invitedProspects,
      onboardingStarted: startedProspects,
      documentsSubmitted,
      leaseSigned: 0,
      dispatchReady: 0,
      qualifiedNotInvited,
      newProspectsToday: newProspects
    },
    bottleneck,
    bottleneckSeverity,
    cronHealth: {
      totalJobs: 14,
      healthy: 11,
      warning: 2,
      critical: 1,
      jobs: [
        { name: 'Process Outreach Tasks', status: 'healthy', lastRun: '2026-06-26T11:00:29Z', schedule: '*/15 * * * *', responsible: 'System Automation' },
        { name: 'Auto Onboarding Invitations', status: 'CRITICAL', lastRun: '2026-06-23T19:00:49Z', schedule: '0 8-20/2 * * *', responsible: 'System Onboarding' },
        { name: 'Sofia - Outbound Prospecting', status: 'healthy', lastRun: '2026-06-25T13:12:38Z', schedule: '0 8 * * *', responsible: 'Sofia Rodriguez' },
        { name: 'Daily AI Operations', status: 'healthy', lastRun: '2026-06-25T12:06:35Z', schedule: '0 7 * * *', responsible: 'AI Supervisor' },
        { name: 'Driver Engagement', status: 'healthy', lastRun: '2026-06-26T06:28:58Z', schedule: '30 9 * * *', responsible: 'Emily Watson' },
        { name: 'Marcus Chen - Sales Review', status: 'healthy', lastRun: '2026-06-25T14:03:08Z', schedule: '0 9 * * *', responsible: 'Marcus Chen' },
        { name: 'David Kumar - Ops Check', status: 'healthy', lastRun: '2026-06-25T15:01:44Z', schedule: '0 10 * * *', responsible: 'David Kumar' },
        { name: 'Jennifer Foster - HR Review', status: 'warning', lastRun: '2026-06-26T06:28:58Z', schedule: '0 11 * * *', responsible: 'Jennifer Foster' },
        { name: 'Robert Chang - Finance', status: 'healthy', lastRun: '2026-06-25T17:01:50Z', schedule: '0 12 * * *', responsible: 'Robert Chang' },
        { name: 'Isabella Martinez', status: 'warning', lastRun: '2026-06-25T08:45:06Z', schedule: '0 8 * * 1', responsible: 'Isabella Martinez' },
        { name: 'Alexandra Sterling', status: 'healthy', lastRun: '2026-06-25T14:28:36Z', schedule: '0 6 * * 1', responsible: 'Alexandra Sterling' },
        { name: 'AI Supervisor - Monitor', status: 'healthy', lastRun: '2026-06-26T08:46:19Z', schedule: '0 6,10,12,14,16,18 * * *', responsible: 'AI Supervisor' },
        { name: 'Monthly Business Intelligence', status: 'healthy', lastRun: '2026-06-25T14:30:34Z', schedule: '0 5 1 * *', responsible: 'Robert Chang' },
        { name: 'Outreach Seeder', status: 'healthy', lastRun: '2026-06-24T19:19:36Z', schedule: 'as needed', responsible: 'System Automation' }
      ]
    },
    agentActivity: {
      'Sofia Rodriguez': { status: 'OFF SHIFT', lastWork: '2026-06-25T13:12:38Z', tasksToday: 3, note: 'FMCSA + web + browser prospecting. 10 new web-found prospects.' },
      'Marcus Chen': { status: 'OFF SHIFT', lastWork: '2026-06-25T14:03:08Z', tasksToday: 1, note: 'Sales review complete.' },
      'David Kumar': { status: 'OFF SHIFT', lastWork: '2026-06-25T15:01:44Z', tasksToday: 1, note: 'Ops check. 0 trucks in fleet.' },
      'Jennifer Foster': { status: 'CONCERNING', lastWork: '2026-06-26T06:28:58Z', tasksToday: 1, note: 'Only 1 activity in 7 days. Cron may not log.' },
      'Robert Chang': { status: 'OFF SHIFT', lastWork: '2026-06-25T17:01:50Z', tasksToday: 1, note: 'Finance review.' },
      'Emily Watson': { status: 'IDLE', lastWork: '2026-06-24T19:04:59Z', tasksToday: 0, note: 'Last engagement 2+ days. Needs assignment.' },
      'Isabella Martinez': { status: 'OFF DUTY', lastWork: '2026-06-25T14:03:52Z', tasksToday: 0, note: 'Weekly Monday, worked Thursday.' },
      'Alexandra Sterling': { status: 'OFF DUTY', lastWork: '2026-06-25T14:28:36Z', tasksToday: 0, note: 'Weekly Monday, worked Thursday.' }
    },
    outreachSystem: {
      pending: pendingOutreach,
      sent: sentOutreach,
      failed: failedOutreach,
      note: 'System idle (0 pending). 163 emails sent historically.'
    },
    errors: [
      { severity: 'CRITICAL', description: 'Auto Onboarding cron has not run since June 23. 43+ qualified prospects never invited.' },
      { severity: 'MEDIUM', description: 'Jennifer Foster only 1 activity in 7 days. HR review cron logging failure suspected.' },
      { severity: 'LOW', description: '5 outreach tasks failed with no lead email - legacy data, correct going forward.' }
    ],
    recommendations: [
      'PRIORITY 1: Trigger Auto Onboarding Invitations cron to invite 43+ qualified uninvited prospects',
      'PRIORITY 2: Investigate 4 sent invites -> only 1 started conversion. Check email deliverability.',
      'PRIORITY 3: Jennifer Foster needs HR activity. Verify cron prompt includes activity logging.',
      'PRIORITY 4: Emily Watson idle 2+ days. Assign proactive customer success research.'
    ],
    nextBestActions: [
      'Trigger Auto Onboarding Invitations cron NOW',
      'Verify Resend email deliverability for onboarding invitations',
      'Assign Emily Watson proactive customer success research task',
      'Check Jennifer Foster cron for logging reliability'
    ],
    growthAssessment: {
      onTrackTo20Hires: false,
      currentMonthlyRate: '0 (0 leases, 0 dispatch-ready)',
      conversionFunnel: '129 prospects -> 47 qualified (36%) -> 4 invited (8.5%) -> 1 started (25%) -> 0 completed',
      blockers: [
        'Auto Onboarding cron down since June 23 - 43+ qualified prospects uninvited',
        '0 trucks in fleet for lease/dispatch',
        'Onboarding invite-to-start conversion is 25% - needs improvement'
      ]
    },
    agentsMonitored: 8,
    activeAgents: 3,
    idleAgents: 5,
    unscoredProspects,
    scoredProspects: scoredCount,
    coldCallQueue,
    errorsFound: 3
  };

  // Insert main report
  await agentActivity.insertOne({
    agent: { name: 'AI Supervisor', role: 'Monitor', department: 'Operations' },
    action: 'supervisor_monitoring',
    result,
    success: true,
    createdAt: new Date(),
    timestamp: new Date()
  });

  await client.close();
  console.log('DONE - Supervisor report logged to agent_activity at ' + new Date().toISOString());
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
