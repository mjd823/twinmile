import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET() {
  try {
    if (!clientPromise) {
      return NextResponse.json({ success: false, error: 'MONGODB_URI not configured' }, { status: 500 })
    }
    const client = await clientPromise
    const db = client.db()

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get prospect counts for Sofia
    const [prospectsToday, prospectsQualified, prospectsPremium] = await Promise.all([
      db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: todayStart } }),
      db.collection('outbound_prospects').countDocuments({ score: { $gte: 75 }, status: 'new' }),
      db.collection('outbound_prospects').countDocuments({ score: { $gte: 85 }, status: 'new' }),
    ])

    // Get quote lead counts for Marcus
    const [pendingQuotes, quotesQuoted, quotesNegotiating, quotesWon] = await Promise.all([
      db.collection('leads_quotes').countDocuments({ status: { $in: ['new', 'qualified'] } }),
      db.collection('leads_quotes').countDocuments({ status: 'quoted' }),
      db.collection('leads_quotes').countDocuments({ status: 'negotiating' }),
      db.collection('leads_quotes').countDocuments({ status: 'converted' }),
    ])

    // Get driver counts for Jennifer/Operations
    const [driversApplied, driversOnboarding, driversCompliance, driversReady] = await Promise.all([
      db.collection('leads_drivers').countDocuments({ status: 'new' }),
      db.collection('leads_drivers').countDocuments({ status: 'onboarding' }),
      db.collection('leads_drivers').countDocuments({ status: 'compliance_check' }),
      db.collection('leads_drivers').countDocuments({ status: 'ready_to_dispatch' }),
    ])

    // Get invoices for Robert
    const invoicesPending = await db.collection('loads').countDocuments({ status: 'delivered', invoiced: { $ne: true } })

    // Get active customers for Emily
    const activeCustomers = await db.collection('customers').countDocuments({ status: 'active' })

    // Get nurture leads for Isabella
    const nurtureLeads = await db.collection('outbound_prospects').countDocuments({ status: 'nurture' })

    // Get recent agent activity for each agent
    const agentNames = [
      'Sofia Rodriguez', 'Marcus Chen', 'Alexandra Sterling',
      'David Kumar', 'Jennifer Foster', 'Robert Chang',
      'Emily Watson', 'Isabella Martinez'
    ]

    const agentActivities: Record<string, any[]> = {}
    for (const name of agentNames) {
      const activity = await db.collection('agent_activity')
        .find({ $or: [
          { agent: name },
          { 'agent.name': name }
        ] })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()
      agentActivities[name] = activity
    }

    // Build agent status objects
    const agents = [
      {
        id: 'lead_generation',
        name: 'Sofia Rodriguez',
        role: 'Lead Generation Specialist',
        color: 'bg-cyan-500',
        icon: 'Target',
        status: prospectsToday > 0 ? 'active' : 'idle',
        currentTask: prospectsToday > 0 
          ? `Found ${prospectsToday} prospects today (${prospectsQualified} qualified, ${prospectsPremium} premium)`
          : 'No prospects found today',
        lastAction: agentActivities['Sofia Rodriguez']?.[0] 
          ? `Found ${prospectsToday} prospects`
          : 'No recent activity',
        tasksToday: prospectsToday,
        lastActivityTime: agentActivities['Sofia Rodriguez']?.[0]?.timestamp,
        nextScheduled: 'Next prospecting: 8:00 AM tomorrow',
      },
      {
        id: 'sales',
        name: 'Marcus Chen',
        role: 'Sales Director',
        color: 'bg-blue-500',
        icon: 'Users',
        status: pendingQuotes > 0 ? 'active' : 'idle',
        currentTask: pendingQuotes > 0
          ? `Building quotes for ${pendingQuotes} pending leads (${quotesQuoted} quoted, ${quotesNegotiating} negotiating)`
          : 'No pending quotes',
        lastAction: agentActivities['Marcus Chen']?.[0]
          ? `Built ${quotesQuoted} quotes, ${quotesWon} won`
          : 'No recent activity',
        tasksToday: pendingQuotes,
        lastActivityTime: agentActivities['Marcus Chen']?.[0]?.timestamp,
        nextScheduled: 'Next quote check: in 15 minutes',
      },
      {
        id: 'ceo',
        name: 'Alexandra Sterling',
        role: 'Chief Executive Officer',
        color: 'bg-purple-500',
        icon: 'Crown',
        status: prospectsPremium > 0 ? 'active' : 'idle',
        currentTask: prospectsPremium > 0
          ? `Reviewing ${prospectsPremium} premium leads (≥85 score) for fast-track`
          : 'Awaiting premium lead escalation',
        lastAction: agentActivities['Alexandra Sterling']?.[0]
          ? `Approved ${prospectsPremium} premium leads for fast-track`
          : 'Weekly review completed',
        tasksToday: prospectsPremium,
        lastActivityTime: agentActivities['Alexandra Sterling']?.[0]?.timestamp,
        nextScheduled: 'Weekly strategic review: Monday 6:00 AM',
      },
      {
        id: 'operations',
        name: 'David Kumar',
        role: 'Operations Director',
        color: 'bg-green-500',
        icon: 'Truck',
        status: driversReady > 0 ? 'busy' : 'idle',
        currentTask: driversReady > 0
          ? `Dispatching ${driversReady} ready drivers (${driversCompliance} in compliance, ${driversOnboarding} onboarding)`
          : 'No ready drivers to dispatch',
        lastAction: agentActivities['David Kumar']?.[0]
          ? `Dispatched ${driversReady} loads`
          : 'No recent dispatches',
        tasksToday: driversReady,
        lastActivityTime: agentActivities['David Kumar']?.[0]?.timestamp,
        nextScheduled: 'Load board check: in 30 minutes',
      },
      {
        id: 'hr',
        name: 'Jennifer Foster',
        role: 'HR Director',
        color: 'bg-orange-500',
        icon: 'UserCheck',
        status: driversOnboarding > 0 ? 'active' : 'idle',
        currentTask: driversOnboarding > 0
          ? `Processing ${driversOnboarding} driver applications (${driversCompliance} in compliance check)`
          : 'No applications in pipeline',
        lastAction: agentActivities['Jennifer Foster']?.[0]
          ? `Advanced ${driversOnboarding} drivers in onboarding`
          : 'No recent onboarding',
        tasksToday: driversOnboarding + driversCompliance,
        lastActivityTime: agentActivities['Jennifer Foster']?.[0]?.timestamp,
        nextScheduled: 'Application review: in 1 hour',
      },
      {
        id: 'finance',
        name: 'Robert Chang',
        role: 'Finance Director',
        color: 'bg-yellow-500',
        icon: 'DollarSign',
        status: invoicesPending > 0 ? 'active' : 'idle',
        currentTask: invoicesPending > 0
          ? `Invoicing ${invoicesPending} delivered loads`
          : 'Processing weekly payroll',
        lastAction: agentActivities['Robert Chang']?.[0]
          ? `Generated ${invoicesPending} invoices`
          : 'Payroll completed',
        tasksToday: invoicesPending,
        lastActivityTime: agentActivities['Robert Chang']?.[0]?.timestamp,
        nextScheduled: 'Weekly payroll: Friday 9:00 AM',
      },
      {
        id: 'customer_success',
        name: 'Emily Watson',
        role: 'Customer Success Manager',
        color: 'bg-red-500',
        icon: 'Heart',
        status: activeCustomers > 0 ? 'active' : 'idle',
        currentTask: activeCustomers > 0
          ? `Monitoring ${activeCustomers} active accounts`
          : 'No active accounts to monitor',
        lastAction: agentActivities['Emily Watson']?.[0]
          ? 'Completed customer check-ins'
          : 'No recent check-ins',
        tasksToday: activeCustomers,
        lastActivityTime: agentActivities['Emily Watson']?.[0]?.timestamp,
        nextScheduled: 'Daily check-ins: 10:00 AM',
      },
      {
        id: 'marketing',
        name: 'Isabella Martinez',
        role: 'Marketing Director',
        color: 'bg-pink-500',
        icon: 'Megaphone',
        status: nurtureLeads > 0 ? 'active' : 'idle',
        currentTask: nurtureLeads > 0
          ? `Nurturing ${nurtureLeads} leads in drip campaigns`
          : 'No nurture pool active',
        lastAction: agentActivities['Isabella Martinez']?.[0]
          ? 'Sent nurture emails'
          : 'No recent campaigns',
        tasksToday: nurtureLeads,
        lastActivityTime: agentActivities['Isabella Martinez']?.[0]?.timestamp,
        nextScheduled: 'Campaign review: Wednesday 2:00 PM',
      },
    ]

    return NextResponse.json({ success: true, agents })
  } catch (error) {
    console.error('[api/admin/agent-status] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch agent status', message: String(error) }, { status: 500 })
  }
}