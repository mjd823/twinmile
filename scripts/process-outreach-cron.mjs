#!/usr/bin/env node
/**
 * Outreach Processing Cron Script
 *
 * Processes pending outreach tasks (emails/SMS) that are due for sending.
 * Runs every 15 minutes via cron job.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { MongoClient, ObjectId } from 'mongodb'
import { Resend } from 'resend'

const MONGODB_URI = process.env.MONGODB_URI
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const RESEND_NOTIFY_TO = process.env.RESEND_NOTIFY_TO || 'admin@twinmile.com'

const MAX_TASKS_PER_RUN = 50
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000

if (!MONGODB_URI) {
  console.error('[process-outreach-cron] MONGODB_URI not set')
  process.exit(1)
}

if (!RESEND_API_KEY) {
  console.warn('[process-outreach-cron] RESEND_API_KEY not set - emails will be logged but not sent')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null
const mongoClient = new MongoClient(MONGODB_URI, {
  appName: 'twinmile-outreach-cron',
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  maxPoolSize: 2,
})

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 }

const EMAIL_TEMPLATES = {
  quote_initial: {
    subject: (lead) => `Your ${lead.serviceType || 'freight'} quote request -- Twin Mile`,
    html: (lead, p) => `<p>Hi ${lead.name},</p><p>Thank you for requesting a quote for ${lead.serviceType || 'freight'} from ${lead.pickupLocation || 'your location'} to ${lead.dropoffLocation || 'destination'}.</p>`,
    text: (lead, p) => `Hi ${lead.name},\n\nThank you for requesting a quote for ${lead.serviceType || 'freight'} from ${lead.pickupLocation || 'your location'} to ${lead.dropoffLocation || 'destination'}.`
  },
  quote_followup: {
    subject: (lead) => `Following up: Your ${lead.serviceType || 'freight'} quote`,
    html: (lead, p) => `<p>Hi ${lead.name},</p><p>Following up on your quote request for ${lead.serviceType || 'freight'} from ${lead.pickupLocation || 'your location'} to ${lead.dropoffLocation || 'destination'}.</p>`,
    text: (lead, p) => `Hi ${lead.name},\n\nFollowing up on your quote request for ${lead.serviceType || 'freight'} from ${lead.pickupLocation || 'your location'} to ${lead.dropoffLocation || 'destination'}.`
  },
  driver_welcome: {
    subject: (lead) => `Welcome to Twin Mile -- Your ${lead.truckType || 'driving'} application`,
    html: (lead, p) => `<p>Hi ${lead.name},</p><p>Thank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || 'driving'}.</p>`,
    text: (lead, p) => `Hi ${lead.name},\n\nThank you for applying to drive with Twin Mile! We've received your application for ${lead.truckType || 'driving'}.`
  },
  driver_followup: {
    subject: (lead) => `Next steps for your Twin Mile application`,
    html: (lead, p) => `<p>Hi ${lead.name},</p><p>Following up on your application to drive with Twin Mile (${lead.truckType || 'driving'}).</p>`,
    text: (lead, p) => `Hi ${lead.name},\n\nFollowing up on your application to drive with Twin Mile (${lead.truckType || 'driving'}).`
  },
  prospect_outreach: {
    subject: (lead) => `${lead.name || 'Your business'} — Drive with Twin Mile`,
    html: (lead, p) => `<p>Hi ${p.name || lead.name},</p><p>We found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.</p><p><strong>Why Twin Mile?</strong></p><ul><li>Competitive pay per mile</li><li>Flexible scheduling</li><li>24/7 driver support</li></ul><p>Ready to learn more? <a href="https://twinmile.com/drive-with-us">Click here to get started</a> or reply to this email.</p><p>Best regards,<br/>Twin Mile Recruiting Team</p>`,
    text: (lead, p) => `Hi ${p.name || lead.name},\n\nWe found your carrier on FMCSA and wanted to reach out about partnering with Twin Mile. We're looking for owner-operators like yourself to join our fleet.\n\nWhy Twin Mile?\n- Competitive pay per mile\n- Flexible scheduling\n- 24/7 driver support\n\nReady to learn more? Visit https://twinmile.com/drive-with-us or reply to this email.\n\nBest regards,\nTwin Mile Recruiting Team`
  },
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function calculateBackoff(attempt) { return BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000 }
function getTemplate(name, lead, p) { const t = EMAIL_TEMPLATES[name]; if (!t) throw new Error(`Unknown: ${name}`); return { subject: t.subject(lead), html: t.html(lead, p), text: t.text(lead, p) } }

async function sendEmailViaResend(to, subject, html, text) {
  if (!resend) { console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`); return { success: true, mock: true } }
  try { const r = await resend.emails.send({ from: RESEND_FROM_EMAIL, to, subject, replyTo: RESEND_NOTIFY_TO, html, text }); return { success: true, id: r.id } }
  catch (e) { console.error(`[Resend] Failed:`, e.message); return { success: false, error: e.message } }
}

async function sendSmsPlaceholder(lead, name, p) {
  const phone = lead.phone || (lead.contact && lead.contact.phone) || p.phone
  if (!phone) return { success: false, error: 'No phone' }
  console.log(`[SMS PLACEHOLDER] To: ${phone} | Template: ${name}`)
  return { success: true, mock: true }
}

async function logActivity(db, task, lead, result, status) {
  const a = { timestamp: new Date(), agent: 'Outreach Processor', activity: `Outreach ${status}: ${task.template} to ${lead.name}`, type: 'outreach', details: { taskId: task._id.toString(), leadId: task.leadId, leadType: task.leadType, channel: task.channel, template: task.template, priority: task.priority, status, attempts: task.attempts + 1, result, sentAt: status==='sent'?new Date():null } }
  await db.collection('agent_activity').insertOne(a)
  console.log(`[Activity] ${a.activity}`)
}

async function processOutreachTasks() {
  console.log('[process-outreach-cron] Starting...')
  const startTime = Date.now()
  try {
    await mongoClient.connect()
    const db = mongoClient.db()
    console.log('[process-outreach-cron] Connected to database')
    const now = new Date()

    const tasks = await db.collection('outreach_tasks')
      .find({ status: { $in: ['pending', 'retrying'] }, scheduledAt: { $lte: now }, $or: [{ attempts: { $lt: MAX_ATTEMPTS } }, { maxAttempts: { $lt: MAX_ATTEMPTS } }] })
      .sort({ scheduledAt: 1 }).limit(MAX_TASKS_PER_RUN).toArray()

    tasks.sort((a,b) => { const d = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; if (d!==0) return d; return new Date(a.scheduledAt) - new Date(b.scheduledAt) })

    console.log(`[process-outreach-cron] Found ${tasks.length} tasks`)
    if (!tasks.length) return { processed: 0, sent: 0, failed: 0, errors: [] }

    let sentCount = 0, failedCount = 0, errors = []
    for (const task of tasks) {
      console.log(`[process-outreach-cron] Task ${task._id} (${task.template}, ${task.priority})`)
      try {
        const coll = task.leadType === 'quote' ? 'leads_quotes' : 
                     task.leadType === 'outbound_prospect' ? 'outbound_prospects' : 
                     task.leadCollection === 'outbound_prospects' ? 'outbound_prospects' :
                     'leads_drivers'
        // leadId may be stored as string or ObjectId — try both
        let lead = await db.collection(coll).findOne({ _id: task.leadId })
        if (!lead && typeof task.leadId === 'string') {
          try { lead = await db.collection(coll).findOne({ _id: new ObjectId(task.leadId) }) } catch(e) {}
        }
        if (!lead && task.leadEmail) {
          // Fallback: find by email
          lead = await db.collection(coll).findOne({ $or: [{ 'contact.email': task.leadEmail }, { email: task.leadEmail }] })
        }
        if (!lead) throw new Error(`Lead not found in ${coll}: leadId=${task.leadId} (leadType: ${task.leadType}), email=${task.leadEmail}`)
        // Normalize lead data — outbound_prospects use nested contact.email/phone
        const leadName = lead.name || lead.company || lead.legal_name || 'Carrier'
        const leadEmail = lead.email || (lead.contact && lead.contact.email) || task.leadEmail
        const leadPhone = lead.phone || (lead.contact && lead.contact.phone) || null
        const p = { ...task.personalization, name: leadName, email: leadEmail, phone: leadPhone, serviceType: lead.serviceType, pickupLocation: lead.pickupLocation, dropoffLocation: lead.dropoffLocation, truckType: lead.truckType, yearsExperience: lead.yearsExperience, company: lead.company }
        let result
        if (task.channel === 'email') { const t = getTemplate(task.template, lead, p); result = await sendEmailViaResend(leadEmail, t.subject, t.html, t.text) }
        else if (task.channel === 'sms') { result = await sendSmsPlaceholder(lead, task.template, p) }
        else throw new Error(`Unknown channel: ${task.channel}`)
        if (result.success) {
          await db.collection('outreach_tasks').updateOne({ _id: task._id }, { $set: { status: 'sent', sentAt: new Date(), updatedAt: new Date(), error: null }, $inc: { attempts: 1 } })
          await logActivity(db, task, lead, result, 'sent')
          sentCount++
          console.log(`[process-outreach-cron] Sent ${task.template} to ${leadEmail}`)
        } else throw new Error(result.error || 'Send error')
        await sleep(100)
      } catch (e) {
        console.error(`[process-outreach-cron] Task ${task._id} failed:`, e.message)
        const na = (task.attempts || 0) + 1
        const max = na >= (task.maxAttempts || MAX_ATTEMPTS)
        await db.collection('outreach_tasks').updateOne({ _id: task._id }, { $set: { status: max?'failed':'retrying', error: e.message, updatedAt: new Date(), scheduledAt: max?task.scheduledAt:new Date(Date.now()+calculateBackoff(na)) }, $inc: { attempts: 1 } })
        const fallbackLead = lead || { name: task.leadName || 'Unknown', email: task.leadEmail || 'N/A' }
        await logActivity(db, task, fallbackLead, { success: false, error: e.message }, max ? 'failed' : 'retrying')
        failedCount++
        errors.push({ taskId: task._id.toString(), error: e.message })
        await sleep(100)
      }
    }
    await mongoClient.close()
    console.log(`[process-outreach-cron] Done: ${sentCount} sent, ${failedCount} failed in ${Date.now() - startTime}ms`)
    return { processed: tasks.length, sent: sentCount, failed: failedCount, errors }
  } catch (e) {
    console.error('[process-outreach-cron] Fatal error:', e)
    await mongoClient.close()
    throw e
  }
}

processOutreachTasks()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) }) 
