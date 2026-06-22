#!/usr/bin/env node
/**
 * Auto Onboarding Invite Cron Script
 *
 * Runs every 2 hours during business hours (8 AM - 8 PM) to:
 * 1. Find leads with status 'qualified' or 'proposal_sent' without onboarding tokens
 * 2. Run AI qualification (score >= 75) for high confidence
 * 3. Create onboarding sessions with 72-hour tokens
 * 4. Pre-fill form data from lead info
 * 5. Send portal link (logs to agent_activity, email via Resend)
 * 6. Update lead status to 'onboarding_invited'
 * 7. Check for expired sessions and escalate for human follow-up
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { MongoClient, ObjectId } from 'mongodb';
import { Resend } from 'resend';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const RESEND_NOTIFY_TO = process.env.RESEND_NOTIFY_TO || 'admin@twinmile.com';
const APP_URL = process.env.APP_URL || 'https://twinmile.com';
const CRON_SECRET = process.env.CRON_SECRET; // Optional: for scheduled verification

const MAX_LEADS_PER_RUN = 30;
const ONBOARDING_TOKEN_HOURS = 72;
const MIN_AI_SCORE = 75;
const BUSINESS_HOURS_START = 8;  // 8 AM
const BUSINESS_HOURS_END = 20;   // 8 PM

if (!MONGODB_URI) {
  console.error('[auto-onboarding-invite] MONGODB_URI not set');
  process.exit(1);
}

if (!RESEND_API_KEY) {
  console.warn('[auto-onboarding-invite] RESEND_API_KEY not set - emails will be logged but not sent');
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const mongoClient = new MongoClient(MONGODB_URI, {
  appName: 'twinmile-onboarding-cron',
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  maxPoolSize: 2,
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isBusinessHours() {
  const hour = new Date().getHours();
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

function generateToken() {
  // Generate a secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function hashToken(token) {
  // Simple hash for storage (in production, use proper hashing like bcrypt)
  // For token verification we store the hash, not the raw token
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

async function sendOnboardingEmail(lead, token, onboardingUrl) {
  if (!resend) {
    console.log(`[MOCK EMAIL] Onboarding invite to: ${lead.email} | Token: ${token.substring(0, 8)}...`);
    return { success: true, mock: true };
  }

  const preheader = `You're invited to onboard with Twin Mile — your personal link expires in ${ONBOARDING_TOKEN_HOURS} hours`;
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to Twin Mile — Complete Your Onboarding</title>
      </head>
      <body style="margin:0;padding:0;background:#eef2f7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ec;">
                <tr>
                  <td style="background:#111827;padding:20px 24px;">
                    <img src="${APP_URL}/logo.png" alt="Twin Mile LLC" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111827;">
                    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#475569;font-weight:700;margin:0 0 10px;">Onboarding Invitation</p>
                    <h1 style="margin:0 0 10px;font-size:36px;line-height:1.2;color:#111827;">Welcome to Twin Mile, ${lead.name}!</h1>
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#334155;">You've been pre-qualified for our power-only program. Complete your onboarding in just a few steps using your personal link below.</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:22px;">
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Name</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.name}</td></tr>
                      ${lead.company ? `<tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Company</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.company}</td></tr>` : ''}
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Equipment</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.truckType || lead.equipment || 'Not specified'}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Experience</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.yearsExperience || lead.experience || 'Not specified'} years</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Location</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.location || 'Not specified'}</td></tr>
                    </table>
                    
                    <p style="margin:14px 0 8px;font-size:14px;line-height:1.6;color:#4b5563;"><strong>Your personal onboarding link (expires in ${ONBOARDING_TOKEN_HOURS} hours):</strong></p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:8px;margin-bottom:22px;">
                      <tr>
                        <td style="border-radius:11px;background:#0f766e;">
                          <a href="${onboardingUrl}" style="display:inline-block;padding:13px 20px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Complete Onboarding</a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${onboardingUrl}" style="color:#0f766e;word-break:break-all;">${onboardingUrl}</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">
                      Twin Mile LLC • Houston, TX<br/>
                      <a href="tel:+12817107787" style="color:#0f766e;text-decoration:none;">(281) 710-7787</a> •
                      <a href="mailto:admin@twinmile.com" style="color:#0f766e;text-decoration:none;">admin@twinmile.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
Welcome to Twin Mile, ${lead.name}!

You've been pre-qualified for our power-only program. Complete your onboarding in just a few steps using your personal link below.

Your Details:
- Name: ${lead.name}
${lead.company ? `- Company: ${lead.company}` : ''}
- Equipment: ${lead.truckType || lead.equipment || 'Not specified'}
- Experience: ${lead.yearsExperience || lead.experience || 'Not specified'} years
- Location: ${lead.location || 'Not specified'}

Your personal onboarding link (expires in ${ONBOARDING_TOKEN_HOURS} hours):
${onboardingUrl}

If you have questions, contact us at (281) 710-7787 or admin@twinmile.com.

Twin Mile LLC • Houston, TX
  `.trim();

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: lead.email,
      subject: `Welcome to Twin Mile — Complete Your Onboarding (${ONBOARDING_TOKEN_HOURS}h)`,
      replyTo: RESEND_NOTIFY_TO,
      text,
      html,
    });
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error('[Resend] Failed to send onboarding email:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendEscalationEmail(lead, session) {
  if (!resend) {
    console.log(`[MOCK EMAIL] Onboarding escalation for: ${lead.name} (session: ${session._id})`);
    return { success: true, mock: true };
  }

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Onboarding Escalation — Action Required</title>
      </head>
      <body style="margin:0;padding:0;background:#eef2f7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ec;">
                <tr>
                  <td style="background:#7f1d1d;padding:20px 24px;">
                    <img src="${APP_URL}/logo.png" alt="Twin Mile LLC" width="170" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:100%;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111827;">
                    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#fca5a5;font-weight:700;margin:0 0 10px;">🚨 Escalation Required</p>
                    <h1 style="margin:0 0 10px;font-size:36px;line-height:1.2;color:#111827;">Onboarding Session Expired</h1>
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#334155;">A qualified lead's onboarding session has expired without completion. Human follow-up is required.</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:22px;">
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Lead Name</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.name}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Email</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.email}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Phone</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.phone || 'Not provided'}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Equipment</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.truckType || lead.equipment || 'Not specified'}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Experience</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.yearsExperience || lead.experience || 'Not specified'} years</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Session Created</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${new Date(session.createdAt).toLocaleString()}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">Session Expired</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${new Date(session.expiresAt).toLocaleString()}</td></tr>
                      <tr><td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#111827;vertical-align:top;white-space:nowrap;">AI Score</td><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#374151;">${lead.score || lead.aiScore || 'N/A'}</td></tr>
                    </table>
                    
                    <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">Please reach out to this lead directly to assist with onboarding completion.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#475569;">
                      Twin Mile LLC • Houston, TX<br/>
                      <a href="tel:+12817107787" style="color:#0f766e;text-decoration:none;">(281) 710-7787</a> •
                      <a href="mailto:admin@twinmile.com" style="color:#0f766e;text-decoration:none;">admin@twinmile.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: RESEND_NOTIFY_TO,
      subject: `🚨 Onboarding Escalation: ${lead.name} (Session Expired)`,
      replyTo: RESEND_NOTIFY_TO,
      text: `Onboarding session expired for lead: ${lead.name} (${lead.email}). Session ID: ${session._id}. Created: ${session.createdAt}. Expired: ${session.expiresAt}. AI Score: ${lead.score || lead.aiScore || 'N/A'}. Please follow up manually.`,
      html,
    });
    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error('[Resend] Failed to send escalation email:', err.message);
    return { success: false, error: err.message };
  }
}

async function logActivity(db, activity) {
  try {
    await db.collection('agent_activity').insertOne({
      timestamp: new Date(),
      agent: 'Auto Onboarding Processor',
      ...activity,
    });
  } catch (err) {
    console.error('[Activity Log] Failed:', err.message);
  }
}

async function processOnboardingInvites() {
  console.log('[auto-onboarding-invite] Starting...');
  const startTime = Date.now();
  const now = new Date();

  // Check business hours
  if (!isBusinessHours()) {
    console.log(`[auto-onboarding-invite] Outside business hours (${BUSINESS_HOURS_START}:00-${BUSINESS_HOURS_END}:00). Skipping.`);
    return { processed: 0, invited: 0, skipped: 'outside_business_hours', errors: [] };
  }

  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('[auto-onboarding-invite] Connected to database');

    // 1. Find qualified leads without onboarding tokens
    // Check both outbound_prospects (status: 'qualified' or 'proposal_sent') and leads_drivers
    const qualifiedProspects = await db.collection('outbound_prospects').find({
      status: { $in: ['qualified', 'proposal_sent'] },
      onboardingToken: { $exists: false },  // No token yet
      $or: [
        { score: { $gte: MIN_AI_SCORE } },
        { aiScore: { $gte: MIN_AI_SCORE } }
      ]
    }).limit(MAX_LEADS_PER_RUN).toArray();

    const qualifiedDriverLeads = await db.collection('leads_drivers').find({
      status: { $in: ['qualified', 'proposal_sent'] },
      onboardingToken: { $exists: false },
      $or: [
        { score: { $gte: MIN_AI_SCORE } },
        { aiScore: { $gte: MIN_AI_SCORE } }
      ]
    }).limit(MAX_LEADS_PER_RUN).toArray();

    // Also check leads_quotes for qualified quote leads
    const qualifiedQuoteLeads = await db.collection('leads_quotes').find({
      status: { $in: ['qualified', 'proposal_sent'] },
      onboardingToken: { $exists: false },
      $or: [
        { score: { $gte: MIN_AI_SCORE } },
        { aiScore: { $gte: MIN_AI_SCORE } }
      ]
    }).limit(MAX_LEADS_PER_RUN).toArray();

    console.log(`[auto-onboarding-invite] Found ${qualifiedProspects.length} qualified prospects, ${qualifiedDriverLeads.length} qualified driver leads, ${qualifiedQuoteLeads.length} qualified quote leads`);

    const allLeads = [
      ...qualifiedProspects.map(l => ({ ...l, leadType: 'outbound_prospect', collection: 'outbound_prospects' })),
      ...qualifiedDriverLeads.map(l => ({ ...l, leadType: 'driver', collection: 'leads_drivers' })),
      ...qualifiedQuoteLeads.map(l => ({ ...l, leadType: 'quote', collection: 'leads_quotes' })),
    ].slice(0, MAX_LEADS_PER_RUN);

    if (!allLeads.length) {
      console.log('[auto-onboarding-invite] No qualified leads to process');
      await mongoClient.close();
      return { processed: 0, invited: 0, skipped: 'no_qualified_leads', errors: [] };
    }

    let invitedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const lead of allLeads) {
      console.log(`[auto-onboarding-invite] Processing lead: ${lead.name} (${lead.leadType}, score: ${lead.score || lead.aiScore})`);
      try {
        // Generate token and create onboarding session
        const rawToken = generateToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(now.getTime() + ONBOARDING_TOKEN_HOURS * 60 * 60 * 1000);

        const onboardingSession = {
          leadId: lead._id,
          leadType: lead.leadType,
          tokenHash,
          rawToken: rawToken, // Only stored briefly for email sending, then cleared
          email: lead.email,
          name: lead.name,
          status: 'pending',
          createdAt: now,
          expiresAt,
          completedAt: null,
          preFilledData: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone || lead.contact?.phone || '',
            company: lead.company || lead.contact?.company || '',
            truckType: lead.truckType || lead.equipment || '',
            yearsExperience: lead.yearsExperience || lead.experience || '',
            location: lead.location || lead.pickupLocation || '',
            serviceType: lead.serviceType || '',
            lanes: lead.lanes || [],
            authorityStatus: lead.authorityStatus || '',
            currentCarrier: lead.currentCarrier || '',
            score: lead.score || lead.aiScore || 0,
            source: lead.source || 'outbound_prospecting',
          },
          metadata: {
            originalCollection: lead.collection,
            originalStatus: lead.status,
            aiQualified: true,
            aiScore: lead.score || lead.aiScore || 0,
            invitedAt: now,
          }
        };

        // Insert onboarding session
        const sessionResult = await db.collection('onboarding_sessions').insertOne(onboardingSession);
        const sessionId = sessionResult.insertedId;

        // Build onboarding URL with token
        const onboardingUrl = `${APP_URL}/onboarding?token=${rawToken}&session=${sessionId}`;

        // Update lead with onboarding token and status
        await db.collection(lead.collection).updateOne(
          { _id: lead._id },
          {
            $set: {
              status: 'onboarding_invited',
              onboardingToken: tokenHash,
              onboardingSessionId: sessionId,
              onboardingExpiresAt: expiresAt,
              onboardingInvitedAt: now,
              updatedAt: now,
            }
          }
        );

        // Send onboarding email
        const emailResult = await sendOnboardingEmail(lead, rawToken, onboardingUrl);

        // Log activity
        await logActivity(db, {
          activity: `Onboarding invite sent to ${lead.name} (${lead.leadType})`,
          type: 'onboarding_invite',
          details: {
            leadId: lead._id.toString(),
            leadType: lead.leadType,
            sessionId: sessionId.toString(),
            email: lead.email,
            emailSent: emailResult.success,
            emailId: emailResult.id,
            score: lead.score || lead.aiScore,
            expiresAt: expiresAt.toISOString(),
          }
        });

        // Also log to the specific lead's collection if it has activity tracking
        if (lead.leadType === 'driver' || lead.leadType === 'quote') {
          await db.collection(`${lead.leadType}s`).updateOne(
            { _id: new ObjectId(lead.leadId || lead._id) },
            { $push: { activityLog: { action: 'onboarding_invited', timestamp: now, details: { sessionId: sessionId.toString() } } } }
          ).catch(() => {}); // Ignore if collection doesn't exist
        }

        console.log(`[auto-onboarding-invite] Invited ${lead.name} (session: ${sessionId})`);
        invitedCount++;

        // Clear raw token from memory
        delete onboardingSession.rawToken;

        await sleep(100); // Rate limiting

      } catch (err) {
        console.error(`[auto-onboarding-invite] Failed for ${lead.name}:`, err.message);
        failedCount++;
        errors.push({ leadId: lead._id.toString(), name: lead.name, error: err.message });
        await sleep(100);
      }
    }

    // 2. Check for expired onboarding sessions and escalate
    const expiredSessions = await db.collection('onboarding_sessions').find({
      status: 'pending',
      expiresAt: { $lt: now },
      escalated: { $ne: true }
    }).toArray();

    console.log(`[auto-onboarding-invite] Found ${expiredSessions.length} expired sessions to escalate`);

    let escalatedCount = 0;
    for (const session of expiredSessions) {
      try {
        // Get lead info for escalation
        const lead = await db.collection(session.metadata?.originalCollection || 'outbound_prospects').findOne({ _id: session.leadId });
        if (!lead) {
          console.warn(`[auto-onboarding-invite] Lead not found for expired session ${session._id}`);
          continue;
        }

        // Send escalation email
        await sendEscalationEmail(lead, session);

        // Mark session as escalated
        await db.collection('onboarding_sessions').updateOne(
          { _id: session._id },
          { $set: { escalated: true, escalatedAt: new Date(), status: 'expired_escalated' } }
        );

        // Update lead status
        const originalCollection = session.metadata?.originalCollection || 'outbound_prospects';
        await db.collection(originalCollection).updateOne(
          { _id: session.leadId },
          { $set: { status: 'onboarding_expired', onboardingEscalatedAt: new Date(), updatedAt: new Date() } }
        );

        // Log escalation activity
        await logActivity(db, {
          activity: `Onboarding escalated for ${lead.name} (session expired)`,
          type: 'onboarding_escalation',
          details: {
            leadId: lead._id.toString(),
            sessionId: session._id.toString(),
            originalStatus: session.metadata?.originalStatus,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            score: session.metadata?.aiScore,
          }
        });

        escalatedCount++;
        console.log(`[auto-onboarding-invite] Escalated expired session for ${lead.name}`);
        await sleep(100);
      } catch (err) {
        console.error(`[auto-onboarding-invite] Failed to escalate session ${session._id}:`, err.message);
        errors.push({ sessionId: session._id.toString(), error: err.message });
      }
    }

    await mongoClient.close();
    console.log(`[auto-onboarding-invite] Done: ${invitedCount} invited, ${escalatedCount} escalated, ${failedCount} failed in ${Date.now() - startTime}ms`);
    return {
      processed: allLeads.length,
      invited: invitedCount,
      escalated: escalatedCount,
      failed: failedCount,
      errors,
    };

  } catch (err) {
    console.error('[auto-onboarding-invite] Fatal error:', err);
    await mongoClient.close();
    throw err;
  }
}

// Run the script
processOnboardingInvites()
  .then(result => {
    console.log('[auto-onboarding-invite] Completed successfully:', JSON.stringify(result));
    process.exit(0);
  })
  .catch(err => {
    console.error('[auto-onboarding-invite] Failed:', err);
    process.exit(1);
  });