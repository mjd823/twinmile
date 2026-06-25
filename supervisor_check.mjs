import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function supervisorCheck() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log('=== 1. PIPELINE FUNNEL COUNTS ===');
  
  // Primary pipeline: outbound_prospects
  const totalProspects = await db.collection('outbound_prospects').countDocuments();
  const newProspects = await db.collection('outbound_prospects').countDocuments({ status: 'new' });
  const reviewedProspects = await db.collection('outbound_prospects').countDocuments({ status: 'reviewed' });
  const onboardingInvitedProspects = await db.collection('outbound_prospects').countDocuments({ status: 'onboarding_invited' });
  const qualifiedProspects = await db.collection('outbound_prospects').countDocuments({
    aiScore: { $gte: 75 },
    status: { $in: ['reviewed', 'onboarding_invited'] }
  });
  const highScoreProspects = await db.collection('outbound_prospects').countDocuments({ aiScore: { $gte: 75 } });
  
  // Onboarding sessions
  const totalSessions = await db.collection('onboarding_sessions').countDocuments();
  const pendingSessions = await db.collection('onboarding_sessions').countDocuments({ status: 'pending' });
  const startedSessions = await db.collection('onboarding_sessions').countDocuments({
    $or: [
      { currentStep: { $gt: 1 } },
      { firstClickedAt: { $exists: true } },
      { status: { $in: ['started', 'documents_submitted', 'completed'] } }
    ]
  });
  const documentsSubmitted = await db.collection('onboarding_sessions').countDocuments({ status: 'documents_submitted' });
  const completedSessions = await db.collection('onboarding_sessions').countDocuments({ status: 'completed' });
  
  // Lease agreements
  const leaseSigned = await db.collection('lease_agreements').countDocuments({ status: 'signed' });
  const leaseApproved = await db.collection('lease_agreements').countDocuments({ status: 'approved' });
  const totalLeases = await db.collection('lease_agreements').countDocuments();
  
  // Prospects created in last 30 days
  const recentProspects = await db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: last30d } });
  const recentQualified = await db.collection('outbound_prospects').countDocuments({
    createdAt: { $gte: last30d },
    aiScore: { $gte: 75 }
  });

  console.log(`Total prospects (outbound_prospects): ${totalProspects}`);
  console.log(`  - New: ${newProspects}`);
  console.log(`  - Reviewed: ${reviewedProspects}`);
  console.log(`  - Onboarding Invited: ${onboardingInvitedProspects}`);
  console.log(`  - Qualified (aiScore>=75, status reviewed/onboarding_invited): ${qualifiedProspects}`);
  console.log(`  - High Score (aiScore>=75, any status): ${highScoreProspects}`);
  console.log(`  - Created in last 30 days: ${recentProspects} (${recentQualified} qualified)`);
  console.log(`Onboarding sessions: ${totalSessions} total, ${pendingSessions} pending, ${startedSessions} started, ${documentsSubmitted} documents, ${completedSessions} completed`);
  console.log(`Lease agreements: ${totalLeases} total, ${leaseSigned} signed, ${leaseApproved} approved`);

  console.log('\n=== 2. BOTTLENECK ANALYSIS ===');
  // Identify bottleneck
  if (qualifiedProspects > onboardingInvitedProspects) {
    console.log(`BOTTLENECK: ${qualifiedProspects} qualified prospects but only ${onboardingInvitedProspects} invited → Invite more qualified prospects to onboarding`);
  } else if (onboardingInvitedProspects > startedSessions) {
    console.log(`BOTTLENECK: ${onboardingInvitedProspects} invited but only ${startedSessions} started → Follow-up campaign needed (Emily/Marcus)`);
  } else if (startedSessions > documentsSubmitted) {
    console.log(`BOTTLENECK: ${startedSessions} started but only ${documentsSubmitted} submitted documents → HR reminder needed (Jennifer)`);
  } else if (documentsSubmitted > leaseSigned) {
    console.log(`BOTTLENECK: ${documentsSubmitted} documents submitted but only ${leaseSigned} leases signed → Finance/contract step needed (Robert)`);
  } else {
    console.log(`BOTTLENECK: Keep prospecting — pipeline flowing normally`);
  }

  console.log('\n=== 3. CRON JOB HEALTH ===');
  
  // Check agent_activity for each cron job's recent activity
  const cronJobs = [
    { id: '00796b3c6135', name: 'Process Outreach Tasks', actions: ['outreach_processing', 'process_outreach', 'outreach_cron', 'outreach_cron_summary', 'outreach_summary', 'outreach_seeding', 'seed_outreach_tasks'], schedule: '*/15 * * * *' },
    { id: '93aaa6272b8c', name: 'Auto Onboarding Invitations', actions: ['auto_onboarding_invite', 'onboarding_invite'], schedule: '0 8-20/2 * * *' },
    { id: '10177a8ab2cf', name: 'Sofia — Outbound Prospecting', actions: ['fmcsa_prospecting', 'outbound_prospecting', 'web_prospecting', 'browser_prospecting'], schedule: '0 8 * * *' },
    { id: '8c53c6ce9d90', name: 'Daily AI Operations', actions: ['daily_ai_ops', 'daily_ops'], schedule: '0 7 * * *' },
    { id: '9ee75230bf31', name: 'Monthly Business Intelligence', actions: ['monthly_bi', 'monthly_report'], schedule: '0 5 1 * *' },
    { id: 'e8dd1c631f6a', name: 'Driver Engagement', actions: ['driver_engagement', 'engagement'], schedule: '30 9 * * *' },
    { id: '4be574df5689', name: 'Marcus Chen — Sales Review', actions: ['daily_sales_review', 'sales_review'], schedule: '0 9 * * *' },
    { id: '05ded9849d2f', name: 'David Kumar — Ops Check', actions: ['daily_ops_check', 'ops_check', 'proactive_fuel_cost_analysis'], schedule: '0 10 * * *' },
    { id: '146d13ca8622', name: 'Jennifer Foster — HR Review', actions: ['hr_onboarding_review', 'onboarding_link_clicked', 'proactive_compliance_research'], schedule: '0 11 * * *' },
    { id: 'e92124812273', name: 'Robert Chang — Finance Review', actions: ['daily_finance_review', 'finance_review'], schedule: '0 12 * * *' },
    { id: 'c977f5067376', name: 'Emily Watson — Customer Success', actions: ['customer_success_check', 'customer_support'], schedule: '0 14 * * *' },
    { id: '2171a406ef62', name: 'Isabella Martinez — Marketing', actions: ['marketing_analysis', 'proactive_seo_analysis'], schedule: '0 8 * * 1' },
    { id: '5dff3683b416', name: 'Alexandra Sterling — CEO Review', actions: ['ceo_strategic_review', 'proactive_strategic_research'], schedule: '0 6 * * 1' },
    { id: 'cfa808bb49c6', name: 'AI Supervisor — Monitor', actions: ['supervisor_monitoring'], schedule: '0 6,12,18 * * *' },
  ];

  for (const job of cronJobs) {
    const lastActivity = await db.collection('agent_activity')
      .find({ action: { $in: job.actions } })
      .sort({ createdAt: -1, timestamp: -1 })
      .limit(1)
      .toArray();
    
    const recentCount = await db.collection('agent_activity').countDocuments({
      action: { $in: job.actions },
      $or: [
        { createdAt: { $gte: last24h } },
        { timestamp: { $gte: last24h } }
      ]
    });
    
    const last = lastActivity[0];
    const lastRun = last?.createdAt || last?.timestamp || null;
    const lastSuccess = last ? last.success !== false : null;
    const status = lastSuccess === true ? '✅ OK' : lastSuccess === false ? '❌ ERROR' : '� NEVER RUN';
    
    let lastRunStr = 'never';
    if (lastRun) {
      const diff = Date.now() - new Date(lastRun).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) lastRunStr = `${mins}m ago`;
      else if (mins < 1440) lastRunStr = `${Math.floor(mins/60)}h ago`;
      else lastRunStr = `${Math.floor(mins/1440)}d ago`;
    }
    
    console.log(`  ${status} ${job.name} (${job.schedule}) — last: ${lastRunStr}, 24h runs: ${recentCount}`);
  }

  console.log('\n=== 4. AGENT ACTIVITY (LAST 24H) ===');
  
  const agentNames = [
    'Sofia Rodriguez', 'Marcus Chen', 'David Kumar', 'Jennifer Foster',
    'Robert Chang', 'Emily Watson', 'Isabella Martinez', 'Alexandra Sterling',
    'AI Supervisor', 'System'
  ];
  
  for (const name of agentNames) {
    const todayActivity = await db.collection('agent_activity').countDocuments({
      $or: [
        { 'agent.name': name },
        { agent: name }
      ],
      $or: [
        { createdAt: { $gte: todayStart } },
        { timestamp: { $gte: todayStart } }
      ]
    });
    
    const lastActivity = await db.collection('agent_activity')
      .find({ $or: [{ 'agent.name': name }, { agent: name }] })
      .sort({ createdAt: -1, timestamp: -1 })
      .limit(1)
      .toArray();
    
    const last = lastActivity[0];
    const lastTime = last?.createdAt || last?.timestamp || null;
    let lastStr = 'never';
    if (lastTime) {
      const diff = Date.now() - new Date(lastTime).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) lastStr = `${mins}m ago`;
      else if (mins < 1440) lastStr = `${Math.floor(mins/60)}h ago`;
      else lastStr = `${Math.floor(mins/1440)}d ago`;
    }
    
    const lastAction = last?.action || last?.activity || '—';
    console.log(`  ${name}: ${todayActivity} tasks today, last: ${lastAction} (${lastStr})`);
  }

  console.log('\n=== 5. RECENT AGENT SUGGESTIONS ===');
  
  const suggestions = await db.collection('agent_activity')
    .find({
      $or: [
        { 'result.recommendations': { $exists: true, $ne: [] } },
        { 'result.suggestion': { $exists: true } },
        { 'details.recommendations': { $exists: true, $ne: [] } },
        { 'result.nextBestActions': { $exists: true, $ne: [] } }
      ],
      $or: [
        { createdAt: { $gte: last7d } },
        { timestamp: { $gte: last7d } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  if (suggestions.length === 0) {
    console.log('  No suggestions found in last 7 days.');
  } else {
    for (const s of suggestions) {
      const agent = s.agent?.name || s.agent || 'Unknown';
      const action = s.action || s.activity || 'unknown';
      const result = s.result || s.details || {};
      const recs = result.recommendations || result.nextBestActions || [];
      const summary = result.summary || '';
      console.log(`  [${agent}] ${action}: ${summary}`);
      if (recs.length > 0) {
        for (const r of recs.slice(0, 3)) {
          console.log(`    → ${r}`);
        }
      }
    }
  }

  console.log('\n=== 6. ERRORS / FAILURES (LAST 24H) ===');
  
  const errors = await db.collection('agent_activity')
    .find({
      success: false,
      $or: [
        { createdAt: { $gte: last24h } },
        { timestamp: { $gte: last24h } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  
  if (errors.length === 0) {
    console.log('  No failures logged in last 24 hours. ✅');
  } else {
    console.log(`  ${errors.length} failures found:`);
    for (const e of errors) {
      const agent = e.agent?.name || e.agent || 'Unknown';
      const action = e.action || e.activity || 'unknown';
      const result = e.result || e.details || {};
      console.log(`    ❌ [${agent}] ${action}: ${result.summary || result.error || JSON.stringify(result).substring(0, 200)}`);
    }
  }

  console.log('\n=== 7. OUTBOUND PROSPECTS — STATUS BREAKDOWN ===');
  
  const statusBreakdown = await db.collection('outbound_prospects')
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    .toArray();
  
  for (const s of statusBreakdown) {
    console.log(`  ${s._id || '(no status)'}: ${s.count}`);
  }

  console.log('\n=== 8. OUTREACH TASKS STATUS ===');
  
  const outreachPending = await db.collection('outreach_tasks').countDocuments({ status: 'pending' });
  const outreachSent = await db.collection('outreach_tasks').countDocuments({ status: 'sent' });
  const outreachFailed = await db.collection('outreach_tasks').countDocuments({ status: 'failed' });
  
  console.log(`  Pending: ${outreachPending}, Sent: ${outreachSent}, Failed: ${outreachFailed}`);

  console.log('\n=== 9. ONBOARDING SESSIONS — STATUS BREAKDOWN ===');
  
  const sessionBreakdown = await db.collection('onboarding_sessions')
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    .toArray();
  
  for (const s of sessionBreakdown) {
    console.log(`  ${s._id || '(no status)'}: ${s.count}`);
  }

  console.log('\n=== 10. GROWTH METRICS (30-DAY) ===');
  
  const prospectsLast30d = await db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: last30d } });
  const qualifiedLast30d = await db.collection('outbound_prospects').countDocuments({
    createdAt: { $gte: last30d },
    aiScore: { $gte: 75 }
  });
  const invitedLast30d = await db.collection('outbound_prospects').countDocuments({
    createdAt: { $gte: last30d },
    status: 'onboarding_invited'
  });
  const sessionsLast30d = await db.collection('onboarding_sessions').countDocuments({ createdAt: { $gte: last30d } });
  const leasesLast30d = await db.collection('lease_agreements').countDocuments({ createdAt: { $gte: last30d } });
  
  console.log(`  Prospects created (30d): ${prospectsLast30d}`);
  console.log(`  Qualified (30d): ${qualifiedLast30d}`);
  console.log(`  Invited (30d): ${invitedLast30d}`);
  console.log(`  Onboarding sessions (30d): ${sessionsLast30d}`);
  console.log(`  Lease agreements (30d): ${leasesLast30d}`);
  
  // Calculate daily rate
  const dailyRate = leasesLast30d / 30;
  console.log(`  Current lease daily rate: ${dailyRate.toFixed(2)}/day → projected monthly: ${(dailyRate * 30).toFixed(1)}`);
  console.log(`  Target: 20 hires/month → need ${(20/30).toFixed(2)} leases/day minimum`);

  console.log('\n=== 11. RECENT PROSPECTS (last 5) ===');
  
  const recentProspectsList = await db.collection('outbound_prospects')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  for (const p of recentProspectsList) {
    console.log(`  ${p.name || p.companyName || 'Unknown'} — status: ${p.status}, aiScore: ${p.aiScore || p.score || 0}, created: ${p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : 'unknown'}`);
  }

  console.log('\n=== 12. RECENT AGENT ACTIVITY (last 10 non-outreach) ===');
  
  const recentActivity = await db.collection('agent_activity')
    .find({
      action: { $nin: ['outreach_processing', 'outreach_cron', 'outreach_cron_summary', 'outreach_summary'] }
    })
    .sort({ createdAt: -1, timestamp: -1 })
    .limit(10)
    .toArray();
  
  for (const a of recentActivity) {
    const agent = a.agent?.name || (typeof a.agent === 'string' ? a.agent : 'System');
    const action = a.action || a.activity || a.type || 'activity';
    const ts = a.createdAt || a.timestamp;
    const tsStr = ts ? new Date(ts).toISOString().replace('T', ' ').substring(0, 16) : 'unknown';
    const success = a.success === false ? '❌' : '✅';
    const result = a.result || a.details || {};
    const summary = result.summary || (typeof result === 'string' ? result : '');
    console.log(`  ${success} [${tsStr}] ${agent}: ${action}${summary ? ' — ' + summary : ''}`);
  }

  await client.close();
}

supervisorCheck().catch(console.error);
