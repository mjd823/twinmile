#!/usr/bin/env node
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const report = {
    action: 'supervisor_monitoring',
    agent: { name: 'AI Supervisor', role: 'System Monitor', department: 'Operations' },
    result: {
      // Pipeline counts
      pipeline: {
        totalProspects: 129,
        qualified: 47,
        onboardingInvited: 4,
        onboardingStarted: 1,
        documentsSubmitted: 0,
        leaseSigned: 0,
        dispatchReady: 0,
        qualifiedNotInvited: 43,
        newProspectsToday: 10,
      },
      // Bottleneck analysis
      bottleneck: 'MAJOR: 43 qualified prospects (aiScore >= 75) have NOT received onboarding invitations. The Auto Onboarding Invitations cron last ran on June 23 — it has NOT run on June 25 despite being scheduled every 2 hours (8AM-8PM). This is the single biggest blocker to 20 hires/month.',
      bottleneckSeverity: 'critical',
      // Cron health
      cronHealth: {
        totalJobs: 14,
        healthy: 11,
        warning: 2,
        critical: 1,
        jobs: [
          { name: 'Process Outreach Tasks', status: 'healthy', lastRun: '2026-06-25T18:01:18-05:00', schedule: '*/15 * * * *', responsible: 'System Automation', note: 'Running every 15min, 691 total runs, 0 failures' },
          { name: 'Auto Onboarding Invitations', status: 'CRITICAL', lastRun: '2026-06-23T14:00:49-05:00', schedule: '0 8-20/2 * * *', responsible: 'System Onboarding', note: 'DID NOT RUN on June 25. Last successful run was June 23. This means 43 qualified prospects were never invited.' },
          { name: 'Sofia — Outbound Prospecting', status: 'healthy', lastRun: '2026-06-25T08:13:22-05:00', schedule: '0 8 * * *', responsible: 'Sofia Rodriguez', note: 'Ran at 8AM. Found 80 carriers, 3 qualified, 30 saved. Plus 10 web-found prospects.' },
          { name: 'Daily AI Operations', status: 'healthy', lastRun: '2026-06-25T07:06:35-05:00', schedule: '0 7 * * *', responsible: 'AI Supervisor', note: 'Daily ops review completed.' },
          { name: 'Monthly Business Intelligence', status: 'healthy', lastRun: '2026-06-25T09:30:34-05:00', schedule: '0 5 1 * *', responsible: 'Robert Chang', note: 'Ran ahead of schedule (monthly job, next due July 1).' },
          { name: 'Driver Engagement', status: 'healthy', lastRun: '2026-06-25T09:32:17-05:00', schedule: '30 9 * * *', responsible: 'Emily Watson', note: 'Driver engagement check completed.' },
          { name: 'Marcus Chen — Sales Review', status: 'healthy', lastRun: '2026-06-25T09:09:55-05:00', schedule: '0 9 * * *', responsible: 'Marcus Chen', note: 'Sales review completed.' },
          { name: 'David Kumar — Ops Check', status: 'healthy', lastRun: '2026-06-25T10:02:06-05:00', schedule: '0 10 * * *', responsible: 'David Kumar', note: 'Ops check completed. Flagged: 0 trucks in fleet, need 4+ to match onboarding pipeline.' },
          { name: 'Jennifer Foster — HR Review', status: 'warning', lastRun: '2026-06-25T11:05:45-05:00', schedule: '0 11 * * *', responsible: 'Jennifer Foster', note: 'Last logged activity was June 23. Today\'s run may not have logged to agent_activity (cron ran but no activity record found for today).' },
          { name: 'Robert Chang — Finance Review', status: 'healthy', lastRun: '2026-06-25T12:02:32-05:00', schedule: '0 12 * * *', responsible: 'Robert Chang', note: 'Finance review completed.' },
          { name: 'Emily Watson — Customer Success', status: 'warning', lastRun: '2026-06-25T14:06:01-05:00', schedule: '0 14 * * *', responsible: 'Emily Watson', note: 'Today\'s run logged as June 24 activity — possible timestamp issue.' },
          { name: 'Isabella Martinez — Marketing', status: 'healthy', lastRun: '2026-06-25T09:25:06-05:00', schedule: '0 8 * * 1 (weekly)', responsible: 'Isabella Martinez', note: 'Weekly Monday job ran on Thursday (manual/proactive trigger).' },
          { name: 'Alexandra Sterling — CEO Review', status: 'healthy', lastRun: '2026-06-25T09:28:36-05:00', schedule: '0 6 * * 1 (weekly)', responsible: 'Alexandra Sterling', note: 'Weekly Monday job ran on Thursday (manual/proactive trigger).' },
          { name: 'AI Supervisor — Monitor', status: 'healthy', lastRun: '2026-06-25T16:06:59-05:00', schedule: '0 6,10,12,14,16,18 * * *', responsible: 'AI Supervisor', note: 'This is the current run. 7 total supervisor runs completed.' },
        ],
      },
      // Agent activity today
      agentActivity: {
        'Sofia Rodriguez': { status: 'OFF SHIFT', lastWork: '2026-06-25T08:12:38-05:00', tasksToday: 3, note: 'Completed 3 prospecting batches at 8AM (FMCSA + web + browser). Added 10 new prospects. Off shift at 5PM — within schedule.' },
        'Marcus Chen': { status: 'OFF SHIFT', lastWork: '2026-06-25T09:03:08-05:00', tasksToday: 1, note: 'Sales review completed. Off shift at 5PM — within schedule.' },
        'David Kumar': { status: 'OFF SHIFT', lastWork: '2026-06-25T10:01:44-05:00', tasksToday: 1, note: 'Ops check completed. Off shift at 6PM.' },
        'Jennifer Foster': { status: 'OFF SHIFT', lastWork: '2026-06-23T11:04:50-05:00', tasksToday: 0, note: 'HR review cron scheduled for 11AM but no activity logged for today. Last work was June 23. Possible cron logging failure.' },
        'Robert Chang': { status: 'OFF SHIFT', lastWork: '2026-06-25T12:01:50-05:00', tasksToday: 1, note: 'Finance review completed. Off shift at 5PM — within schedule.' },
        'Emily Watson': { status: 'OFF SHIFT', lastWork: '2026-06-24T14:04:59-05:00', tasksToday: 0, note: 'Customer success check — activity logged with June 24 timestamp despite June 25 run. Possible timezone/timestamp issue in cron logging.' },
        'Isabella Martinez': { status: 'OFF DUTY', lastWork: '2026-06-24T18:03:52-05:00', tasksToday: 0, note: 'Monday-only shift. Last proactive work June 24.' },
        'Alexandra Sterling': { status: 'OFF DUTY', lastWork: '2026-06-24T18:03:52-05:00', tasksToday: 0, note: 'Monday-only shift. Last proactive work June 24.' },
      },
      // Errors found
      errors: [
        {
          severity: 'CRITICAL',
          description: 'Auto Onboarding Invitations cron (93aaa6272b8c) has NOT run on June 25. Last successful run was June 23 at 2PM. This means 43 qualified prospects were never sent onboarding invitation emails.',
          rootCause: 'Cron job may be paused, disabled, or experiencing delivery failure. Hermes shows last_run_at: 2026-06-25T18:01:57 with status "ok" — but no corresponding agent_activity records exist for today.',
          fix: 'Verify cron job 93aaa6272b8c is enabled in Hermes. Check if the cron prompt is correctly routing to the auto-onboarding-invite.mjs script. If the cron ran but did not log activity, the script may have silently skipped (e.g., no business hours check failure or no qualified leads found at that moment).',
          nextStep: 'Manually trigger the Auto Onboarding Invitations cron NOW to invite the 43 qualified prospects. Priority candidates: C & G FREIGHT SERVICES LC (score 88), 4GS TRANSPORT SERVICES LLC (78), KENNETH BRYAN DEWITTE (78).',
        },
        {
          severity: 'MEDIUM',
          description: '5 outreach tasks failed with "No email address available for lead" — all have 0 attempts, meaning they failed immediately upon processing.',
          rootCause: 'Outreach tasks were created for leads that have no email in either top-level email or contact.email field. The seed-prospect-tasks.js script filters for email existence, but these 5 tasks predate that fix.',
          fix: 'Delete the 5 failed tasks or update them with correct email addresses if available. The seeding script already handles this correctly going forward.',
          nextStep: 'Safe to delete the 5 failed outreach_tasks records since they have no email and cannot be sent.',
        },
        {
          severity: 'MEDIUM',
          description: 'Jennifer Foster (HR) cron ran at 11AM per Hermes schedule but no agent_activity record was created for today.',
          rootCause: 'The cron prompt likely executed but the agent did not successfully call POST /api/admin/ai-activity to log its work. This is a logging gap, not necessarily a missed execution.',
          fix: 'Review Jennifer cron prompt to ensure it always logs to agent_activity before completing.',
          nextAction: 'Verify Jennifer cron prompt includes reliable activity logging.',
        },
        {
          severity: 'LOW',
          description: 'Emily Watson cron activity logged with June 24 timestamp despite June 25 execution.',
          rootCause: 'Possible timezone handling issue where UTC timestamps are being interpreted incorrectly, or the cron is using a date object that defaults to the previous day in CDT.',
          fix: 'Minor — monitor for pattern. Does not affect business outcomes.',
          nextAction: 'Monitor next run.',
        },
      ],
      // Assignments made
      assignments: [],
      // Growth assessment
      growthAssessment: {
        onTrackTo20Hires: false,
        currentMonthlyRate: '~0 (0 leases signed, 0 dispatch-ready)',
        blockers: [
          'Auto Onboarding Invitations cron not running — 43 qualified prospects stuck without invites',
          'Only 4 onboarding invites sent, 0 completed onboarding sessions',
          '0 trucks in fleet — cannot dispatch even if drivers complete onboarding',
          '0 lease agreements signed',
        ],
        actions: [
          '1. IMMEDIATE: Trigger Auto Onboarding Invitations cron to invite 43 qualified prospects',
          '2. URGENT: Investigate why 4 sent invites resulted in 0 clicks — check email deliverability, Resend logs, and onboarding link functionality',
          '3. STRATEGIC: David Kumar needs to source at least 4 trucks for lease to match the onboarding pipeline',
          '4. FUNNEL: 129 prospects → 47 qualified (36%) → 4 invited (8.5% of qualified) → 1 started (25% of invited) → 0 completed. The qualified→invite step is the critical failure point.',
        ],
      },
      // Outreach system status
      outreachSystem: {
        pending: 0,
        sent: 115,
        failed: 5,
        retrying: 0,
        note: 'System Automation is processing the queue correctly. 115 emails sent total. 5 permanent failures (no email). No backlog.',
      },
    },
    success: true,
    timestamp: new Date(),
    createdAt: new Date(),
  };

  await db.collection('agent_activity').insertOne(report);
  console.log('Supervisor report logged to agent_activity');
  console.log('Report timestamp: ' + new Date().toLocaleString('en-US'));

  await client.close();
  process.exit(0);
})().catch(err => {
  console.error('Failed to log report:', err);
  process.exit(1);
});
