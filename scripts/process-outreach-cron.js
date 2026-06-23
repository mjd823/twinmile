/**
 * Outreach Processing Cron Script
 * 
 * 1. Finds all pending outreach tasks that are due (scheduledAt <= now)
 * 2. Loads the associated lead data
 * 3. Sends personalized emails via Resend (and SMS placeholder)
 * 4. Updates task status to 'sent' with sentAt timestamp
 * 5. Logs all activity to agent_activity collection
 * 6. Handles retries (max 3 attempts) with exponential backoff
 *
 * Processes tasks in priority order: urgent → high → medium → low.
 * Maximum 50 tasks per run to avoid rate limits.
 */

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');
const { Resend } = require('resend');

const MAX_TASKS_PER_RUN = 50;
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 5000; // 5 seconds base for exponential backoff

const MONGODB_URI = process.env.MONGODB_URI;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Twin Mile <alerts@contact.twinmile.com>';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY is not set — emails will be logged but not sent');
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ── Email Templates ──────────────────────────────────────────────────────

function buildEmailSubject(task, lead) {
  const templates = {
    driver_followup: `Drive with Twin Mile — Consistent Lanes, Weekly Pay`,
    driver_welcome: `Welcome to Twin Mile — Next Steps`,
    quote_followup: `Your Quote from Twin Mile — Any Questions?`,
    prospect_outreach: `Power-Only Opportunities with Twin Mile for ${lead.name || 'Owner-Operators'}`,
    re_engagement: `Still Looking for Better Lanes? — Twin Mile Update`,
    default: `Twin Mile LLC — Following Up`,
  };
  return templates[task.template] || templates.default;
}

function buildEmailText(task, lead) {
  const name = lead.name || lead.fullName || 'there';
  const templates = {
    driver_followup: `Hi ${name},

I'm reaching out from Twin Mile LLC. We specialize in power-only freight with consistent lanes across TX, LA, CA, and surrounding regions.

What we offer:
• 80% gross pay — weekly settlements
• Consistent lanes (no sitting around waiting for loads)
• Power-only — you bring the tractor, we provide the freight
• Fuel advances available

We'd love to learn more about your operation and see if there's a fit. Reply to this email or call us at (281) 710-7787.

Best regards,
Twin Mile LLC
https://twinmile.com`,
    driver_welcome: `Hi ${name},

Thanks for applying to drive with Twin Mile! We're reviewing your application and will reach out within 1-2 business days.

In the meantime, feel free to explore our services at https://twinmile.com/services or call us at (281) 710-7787 if you have questions.

Best regards,
Twin Mile LLC`,
    quote_followup: `Hi ${name},

Thanks for requesting a quote from Twin Mile. Our team is reviewing your request and will follow up shortly with pricing.

If you have any questions or need to add details, just reply to this email.

Best regards,
Twin Mile LLC
https://twinmile.com`,
    prospect_outreach: `Hi ${name},

I'm reaching out from Twin Mile LLC. We're a power-only logistics company based in Houston, TX, and we're actively looking for owner-operators to join our network.

Why Twin Mile?
• 80% of gross revenue — paid weekly
• Consistent lanes (TX-LA, TX-CA, regional and OTR)
• No trailer required — power only
• Straightforward contracts, no hidden fees

If you're open to a conversation, reply to this email or call (281) 710-7787.

Best regards,
Twin Mile LLC
https://twinmile.com`,
    re_engagement: `Hi ${name},

It's been a while since we last connected. We've expanded our lane coverage and have new opportunities that might be a great fit.

Updated offerings:
• New lanes through TX, LA, CA, GA, TN
• Weekly pay at 80% gross
• Fuel card program with discounts

Interested? Reply to this email or call (281) 710-7787.

Best regards,
Twin Mile LLC`,
    default: `Hi ${name},

Twin Mile LLC is following up regarding your interest in our power-only freight program.

Reply to this email or call (281) 710-7787 to discuss next steps.

Best regards,
Twin Mile LLC
https://twinmile.com`,
  };
  return templates[task.template] || templates.default;
}

function buildEmailHtml(task, lead) {
  const name = lead.name || lead.fullName || 'there';
  const text = buildEmailText(task, lead);
  const subject = buildEmailSubject(task, lead);

  // Convert plain text to simple HTML
  const bodyHtml = text
    .split('\n')
    .map(line => {
      if (line.trim() === '') return '<br/>';
      if (line.startsWith('• ')) return `<p style="margin:2px 0 2px 16px;font-size:14px;line-height:1.6;color:#374151;">${line}</p>`;
      return `<p style="margin:8px 0;font-size:14px;line-height:1.6;color:#374151;">${line}</p>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ec;">
<tr><td style="background:#111827;padding:20px 24px;">
<span style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">Twin Mile LLC</span>
</td></tr>
<tr><td style="padding:24px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111827;">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">
Twin Mile LLC &bull; Houston, TX<br/>
<a href="tel:+12817107787" style="color:#0f766e;text-decoration:none;">(281) 710-7787</a> &bull;
<a href="mailto:admin@twinmile.com" style="color:#0f766e;text-decoration:none;">admin@twinmile.com</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Lead Data Loader ─────────────────────────────────────────────────────

async function loadLeadData(db, task) {
  const leadId = task.leadId;
  if (!leadId) return task.personalization || {};

  let lead = null;
  try {
    // leadId might be a string or ObjectId — try the collections based on leadType
    let collection;
    if (task.leadType === 'driver') {
      collection = 'drivers';
    } else if (task.leadType === 'prospect' || task.leadType === 'outbound_prospect') {
      collection = 'outbound_prospects';
    } else if (task.leadType === 'quote') {
      collection = 'leads_quotes';
    } else {
      // Try common collections
      collection = null;
    }

    if (collection) {
      let query = { _id: leadId };
      // Try with ObjectId if it looks like one
      if (typeof leadId === 'string' && leadId.length === 24 && /^[0-9a-fA-F]+$/.test(leadId)) {
        const { ObjectId } = require('mongodb');
        try {
          query = { $or: [{ _id: leadId }, { _id: new ObjectId(leadId) }] };
        } catch (_) {}
      }
      lead = await db.collection(collection).findOne(query);
    }

    // Fallback: try leads_drivers
    if (!lead) {
      let query = { _id: leadId };
      if (typeof leadId === 'string' && leadId.length === 24 && /^[0-9a-fA-F]+$/.test(leadId)) {
        const { ObjectId } = require('mongodb');
        try {
          query = { $or: [{ _id: leadId }, { _id: new ObjectId(leadId) }] };
        } catch (_) {}
      }
      lead = await db.collection('leads_drivers').findOne(query);
    }
  } catch (err) {
    console.error(`  ⚠️  Error loading lead data for task ${task._id}:`, err.message);
  }

  // Merge: personalization overrides lead data, lead data fills gaps
  return {
    ...(lead || {}),
    ...(task.personalization || {}),
  };
}

// ── Email Sending ─────────────────────────────────────────────────────────

async function sendOutreachEmail(task, lead) {
  if (!resend) {
    console.log(`  📧 [DRY-RUN] Email would be sent to ${lead.email || lead.contact?.email || 'NO EMAIL'}`);
    return { id: 'dry-run', skipped: true };
  }

  const to = lead.email || lead.contact?.email;
  if (!to) {
    throw new Error('No email address available for lead');
  }

  const subject = buildEmailSubject(task, lead);
  const text = buildEmailText(task, lead);
  const html = buildEmailHtml(task, lead);

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    replyTo: 'admin@twinmile.com',
    text,
    html,
  });

  return result.data || result;
}

async function sendSmsPlaceholder(task, lead) {
  const phone = lead.phone || lead.contact?.phone;
  if (!phone) {
    return { skipped: true, reason: 'no phone number' };
  }
  // SMS is a placeholder for now — log intent
  console.log(`  📱 [SMS-PLACEHOLDER] Would send SMS to ${phone}: "${buildEmailSubject(task, lead)}"`);
  return { skipped: true, reason: 'SMS not yet implemented' };
}

// ── Retry with Exponential Backoff ───────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(task, lead) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const emailResult = await sendOutreachEmail(task, lead);
      await sendSmsPlaceholder(task, lead);
      return { success: true, emailResult, attempt };
    } catch (err) {
      lastError = err;
      console.error(`  ⚠️  Attempt ${attempt}/${MAX_ATTEMPTS} failed for task ${task._id}: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`     Retrying in ${backoff / 1000}s (exponential backoff)...`);
        await sleep(backoff);
      }
    }
  }
  return { success: false, error: lastError, attempt: MAX_ATTEMPTS };
}

// ── Main Processing Logic ────────────────────────────────────────────────

async function main() {
  const startTime = new Date();
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📬 Outreach Processing Cron — ${startTime.toISOString()}`);
  console.log(`${'═'.repeat(70)}\n`);

  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    retryWrites: true,
  });

  try {
    await client.connect();
    const db = client.db();

    // ── Step 1: Find all pending due tasks, sorted by priority ──────
    const now = new Date();
    const allDueTasks = [];

    for (const priority of PRIORITY_ORDER) {
      const tasks = await db.collection('outreach_tasks')
        .find({
          status: { $in: ['pending', 'retrying'] },
          scheduledAt: { $lte: now },
          priority: priority,
          attempts: { $lt: MAX_ATTEMPTS },
        })
        .sort({ scheduledAt: 1 })
        .limit(MAX_TASKS_PER_RUN - allDueTasks.length)
        .toArray();

      allDueTasks.push(...tasks);
      if (allDueTasks.length >= MAX_TASKS_PER_RUN) break;
    }

    // Also fetch any tasks without a priority field (treat as low)
    if (allDueTasks.length < MAX_TASKS_PER_RUN) {
      const noPriorityTasks = await db.collection('outreach_tasks')
        .find({
          status: { $in: ['pending', 'retrying'] },
          scheduledAt: { $lte: now },
          priority: { $exists: false },
          attempts: { $lt: MAX_ATTEMPTS },
        })
        .sort({ scheduledAt: 1 })
        .limit(MAX_TASKS_PER_RUN - allDueTasks.length)
        .toArray();
      allDueTasks.push(...noPriorityTasks);
    }

    console.log(`📋 Found ${allDueTasks.length} due outreach task(s) (max ${MAX_TASKS_PER_RUN} per run)\n`);

    if (allDueTasks.length === 0) {
      console.log('✅ No due outreach tasks to process. Exiting.');
      await db.collection('agent_activity').insertOne({
        createdAt: new Date(),
        agent: { name: 'Outreach Cron', role: 'Outreach Processor', department: 'Sales' },
        activity: 'Outreach processing run: no due tasks found',
        action: 'outreach_processing', type: 'outreach_cron',
        details: { tasksProcessed: 0, runTime: startTime.toISOString() },
        success: true,
      }).catch(() => {});
      await client.close();
      process.exit(0);
      return;
    }

    // ── Step 2-6: Process each task ──────────────────────────────────
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    for (const task of allDueTasks) {
      const taskStart = new Date();
      const taskId = task._id.toString();
      console.log(`\n── Task ${taskId} ──`);
      console.log(`  Template: ${task.template || 'default'}`);
      console.log(`  Priority: ${task.priority || 'low'}`);
      console.log(`  Channel:  ${task.channel || 'email'}`);
      console.log(`  Attempts: ${task.attempts || 0}/${MAX_ATTEMPTS}`);

      // Step 2: Load lead data
      const lead = await loadLeadData(db, task);
      const leadName = lead.name || lead.fullName || 'Unknown';
      const leadEmail = lead.email || lead.contact?.email;
      console.log(`  Lead:    ${leadName}`);
      console.log(`  Email:   ${leadEmail || 'N/A'}`);

      // Skip if no email and channel is email
      if ((task.channel || 'email') === 'email' && !leadEmail) {
        console.log(`  ⏭️  Skipping — no email address available`);
        await db.collection('outreach_tasks').updateOne(
          { _id: task._id },
          {
            $set: {
              status: 'failed',
              error: 'No email address available for lead',
              updatedAt: new Date(),
            },
          }
        );
        skipped++;
        results.push({ taskId, status: 'skipped', reason: 'no email' });
        continue;
      }

      // Step 3: Send email with retry (Step 6: exponential backoff)
      const sendResult = await sendWithRetry(task, lead);

      if (sendResult.success) {
        // Step 4: Update task status to 'sent' with sentAt timestamp
        await db.collection('outreach_tasks').updateOne(
          { _id: task._id },
          {
            $set: {
              status: 'sent',
              sentAt: new Date(),
              attempts: (task.attempts || 0) + sendResult.attempt,
              updatedAt: new Date(),
            },
          }
        );
        console.log(`  ✅ Sent successfully (attempt ${sendResult.attempt})`);
        sent++;

        results.push({
          taskId,
          status: 'sent',
          leadName,
          leadEmail,
          template: task.template,
          attempt: sendResult.attempt,
          messageId: sendResult.emailResult?.id || null,
        });
      } else {
        // Update task with failed attempt
        const newAttempts = (task.attempts || 0) + MAX_ATTEMPTS;
        const shouldFail = newAttempts >= MAX_ATTEMPTS;
        await db.collection('outreach_tasks').updateOne(
          { _id: task._id },
          {
            $set: {
              status: shouldFail ? 'failed' : 'retrying',
              attempts: newAttempts,
              error: sendResult.error?.message || 'Unknown error',
              updatedAt: new Date(),
              ...(shouldFail ? { failedAt: new Date() } : { nextRetryAt: new Date(Date.now() + BASE_BACKOFF_MS * Math.pow(2, MAX_ATTEMPTS)) }),
            },
          }
        );
        console.log(`  ❌ All ${MAX_ATTEMPTS} attempts failed — ${shouldFail ? 'marked as failed' : 'marked for retry'}`);
        failed++;

        results.push({
          taskId,
          status: shouldFail ? 'failed' : 'retrying',
          leadName,
          error: sendResult.error?.message,
          attempts: newAttempts,
        });
      }

      // Step 5: Log activity to agent_activity
      try {
        await db.collection('agent_activity').insertOne({
          createdAt: new Date(),
          agent: { name: 'Outreach Cron', role: 'Outreach Processor', department: 'Sales' },
          activity: sendResult.success
            ? `Outreach email sent to ${leadName} (${leadEmail}) via template "${task.template}"`
            : `Outreach email FAILED to ${leadName} — ${sendResult.error?.message}`,
          action: 'outreach_processing', type: 'outreach_cron',
          taskId: task._id,
          details: {
            taskId,
            leadName,
            leadEmail,
            template: task.template,
            priority: task.priority,
            channel: task.channel,
            attempt: sendResult.attempt,
            success: sendResult.success,
            error: sendResult.error?.message || null,
            messageId: sendResult.emailResult?.id || null,
            durationMs: Date.now() - taskStart.getTime(),
          },
          success: sendResult.success,
          createdAt: new Date(),
        });
      } catch (logErr) {
        console.error(`  ⚠️  Failed to log agent activity: ${logErr.message}`);
      }
    }

    // ── Summary ──────────────────────────────────────────────────────
    const endTime = new Date();
    const durationSec = ((endTime - startTime) / 1000).toFixed(1);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 OUTREACH CRON SUMMARY`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Total tasks found:  ${allDueTasks.length}`);
    console.log(`  Sent successfully:  ${sent}`);
    console.log(`  Failed:             ${failed}`);
    console.log(`  Skipped (no email): ${skipped}`);
    console.log(`  Duration:           ${durationSec}s`);
    console.log(`  Timestamp:          ${endTime.toISOString()}`);
    console.log(`${'═'.repeat(70)}\n`);

    // Log summary to agent_activity
    try {
      await db.collection('agent_activity').insertOne({
        createdAt: endTime,
        agent: { name: 'Outreach Cron', role: 'Outreach Processor', department: 'Sales' },
        activity: `Outreach cron run: ${sent} sent, ${failed} failed, ${skipped} skipped (of ${allDueTasks.length} tasks in ${durationSec}s)`,
        action: 'outreach_summary', type: 'outreach_cron_summary',
        details: {
          totalTasks: allDueTasks.length,
          sent,
          failed,
          skipped,
          durationSec: parseFloat(durationSec),
          runStart: startTime.toISOString(),
          runEnd: endTime.toISOString(),
          results,
        },
        success: true,
        createdAt: endTime,
      });
    } catch (logErr) {
      console.error('⚠️  Failed to log summary to agent_activity:', logErr.message);
    }

    await client.close();
    console.log('✅ Outreach processing complete. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Outreach cron failed:', error);
    console.error(error.stack);
    try {
      const db = client.db();
      await db.collection('agent_activity').insertOne({
        createdAt: new Date(),
        agent: { name: 'Outreach Cron', role: 'Outreach Processor', department: 'Sales' },
        activity: `Outreach cron FAILED: ${error.message}`,
        action: 'outreach_error', type: 'outreach_cron_error',
        details: { error: error.message, stack: error.stack },
        success: false,
        createdAt: new Date(),
      });
    } catch (_) {}
    await client.close();
    process.exit(1);
  }
}

main();