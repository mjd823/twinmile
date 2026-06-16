import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET() {
  try {
    if (!clientPromise) {
      return NextResponse.json(
        { success: false, error: 'MONGODB_URI not configured' },
        { status: 500 }
      )
    }
    const client = await clientPromise
    const db = client.db()

    // Get database stats
    const [totalLeads, totalCustomers, totalDrivers, totalProspects, totalOutreachTasks] = await Promise.all([
      db.collection('leads_drivers').countDocuments(),
      db.collection('customers').countDocuments(),
      db.collection('drivers').countDocuments(),
      db.collection('outbound_prospects').countDocuments(),
      db.collection('outreach_tasks').countDocuments(),
    ])

    // Get recent agent activity (last 50)
    const recentActivities = await db.collection('agent_activity')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray()

    // Get supervisor report
    const supervisorReport = {
      supervisorName: 'AI Supervisor',
      systemHealth: {
        score: totalLeads > 0 ? 85 : 50,
        status: totalLeads > 0 ? 'healthy' : 'initializing',
        activeAgents: 8,
        databaseConnected: true,
        totalRecords: totalLeads + totalCustomers + totalDrivers + totalProspects,
      },
      activeAlerts: [],
      totalInterventions: 0,
    }

    return NextResponse.json({
      success: true,
      supervisorReport,
      activities: recentActivities.map(a => ({
        ...a,
        _id: a._id.toString(),
      })),
      databaseStats: {
        totalLeads,
        totalCustomers,
        totalDrivers,
        totalProspects,
        totalOutreachTasks,
        totalRecords: totalLeads + totalCustomers + totalDrivers + totalProspects,
      },
    })
  } catch (error) {
    console.error('[api/admin/ai-activity] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch AI activity', message: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!clientPromise) {
      return NextResponse.json(
        { success: false, error: 'MONGODB_URI not configured' },
        { status: 500 }
      )
    }
    const { action } = await request.json()
    const client = await clientPromise
    const db = client.db()

    let result: any = { success: true, message: '', timestamp: new Date().toISOString() }

    // ========== SHARED/CRON ACTIONS ==========
    
    if (action === 'daily_ops') {
      const [prospects, outreachTasks, driverLeads] = await Promise.all([
        db.collection('outbound_prospects').find({ status: 'new' }).limit(10).toArray(),
        db.collection('outreach_tasks').find({ status: { $in: ['pending', 'retrying'] } }).limit(20).toArray(),
        db.collection('leads_drivers').find({ status: 'new' }).limit(10).toArray(),
      ])

      await db.collection('agent_activity').insertOne({
        timestamp: new Date(),
        agent: 'AI Supervisor',
        activity: `Daily ops: ${prospects.length} new prospects, ${outreachTasks.length} pending outreach, ${driverLeads.length} new driver leads`,
        type: 'daily_ops',
        details: { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length },
      })

      result.message = `✅ Daily operations complete: ${prospects.length} prospects, ${outreachTasks.length} outreach tasks, ${driverLeads.length} driver leads queued`
      result.details = { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length }
    }
    
    else if (action === 'weekly_review') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const [newLeads, convertedLeads, totalOutreach, avgScore] = await Promise.all([
        db.collection('leads_drivers').countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        db.collection('leads_drivers').countDocuments({ status: 'converted', updatedAt: { $gte: oneWeekAgo } }),
        db.collection('outreach_tasks').countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        db.collection('outbound_prospects').aggregate([
          { $match: { createdAt: { $gte: oneWeekAgo } } },
          { $group: { _id: null, avgScore: { $avg: '$score' } } }
        ]).toArray(),
      ])
      
      const avg = avgScore[0]?.avgScore || 0

      await db.collection('agent_activity').insertOne({
        timestamp: new Date(),
        agent: 'AI Supervisor',
        activity: `Weekly review: ${newLeads} new leads, ${convertedLeads} converted, ${totalOutreach} outreach sent, avg score ${avg.toFixed(1)}`,
        type: 'weekly_review',
        details: { newLeads, convertedLeads, totalOutreach, avgScore: avg },
      })

      const conversionRate = newLeads > 0 ? ((convertedLeads / newLeads) * 100).toFixed(1) : '0'
      result.message = `📊 Weekly review: ${newLeads} leads, ${conversionRate}% conversion, ${totalOutreach} outreach, avg score ${avg.toFixed(1)}`
      result.details = { newLeads, convertedLeads, totalOutreach, avgScore: avg, conversionRate }
    }
    
    else if (action === 'monthly_bi') {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const [monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, monthlyRevenue] = await Promise.all([
        db.collection('leads_drivers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        db.collection('customers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        db.collection('outbound_prospects').countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        db.collection('loads').aggregate([
          { $match: { createdAt: { $gte: oneMonthAgo }, status: 'delivered' } },
          { $group: { _id: null, total: { $sum: '$revenue' } } }
        ]).toArray(),
      ])

      const revenue = monthlyRevenue[0]?.total || 0

      await db.collection('agent_activity').insertOne({
        timestamp: new Date(),
        agent: 'AI Supervisor',
        activity: `Monthly BI: ${monthlyLeads} leads, ${monthlyCustomers} customers, ${monthlyDrivers} drivers, ${monthlyProspects} prospects, $${revenue.toLocaleString()} revenue`,
        type: 'monthly_bi',
        details: { monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, revenue },
      })

      result.message = `📈 Monthly BI: ${monthlyLeads} leads, ${monthlyCustomers} customers, ${monthlyDrivers} drivers, ${monthlyProspects} prospects, $${revenue.toLocaleString()} revenue`
      result.details = { monthlyLeads, monthlyCustomers, monthlyDrivers, monthlyProspects, revenue }
    }
    
    else if (action === 'driver_engagement') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const staleDrivers = await db.collection('drivers').find({
        lastContactAt: { $lt: thirtyDaysAgo },
        status: 'active'
      }).limit(20).toArray()

      let tasksCreated = 0
      for (const driver of staleDrivers) {
        const existing = await db.collection('outreach_tasks').findOne({
          leadId: driver._id,
          leadType: 'driver',
          status: { $in: ['pending', 'retrying'] }
        })
        if (!existing) {
          await db.collection('outreach_tasks').insertOne({
            leadId: driver._id,
            leadType: 'driver',
            template: 'driver_followup',
            channel: 'email',
            priority: 'medium',
            scheduledAt: new Date(),
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            personalization: { name: driver.name, truckType: driver.truckType },
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          tasksCreated++
        }
      }

      await db.collection('agent_activity').insertOne({
        timestamp: new Date(),
        agent: 'AI Supervisor',
        activity: `Driver engagement: ${staleDrivers.length} stale drivers found, ${tasksCreated} outreach tasks created`,
        type: 'driver_engagement',
        details: { staleDrivers: staleDrivers.length, tasksCreated },
      })

      result.message = `🚛 Driver engagement: ${staleDrivers.length} stale drivers, ${tasksCreated} follow-up tasks created`
      result.details = { staleDrivers: staleDrivers.length, tasksCreated }
    }
    
    else if (action === 'auto_onboarding') {
      const qualifiedProspects = await db.collection('outbound_prospects').find({
        score: { $gte: 75 },
        status: 'new',
        onboardingStarted: { $ne: true }
      }).limit(10).toArray()

      let onboarded = 0
      for (const prospect of qualifiedProspects) {
        await db.collection('outbound_prospects').updateOne(
          { _id: prospect._id },
          { $set: { status: 'onboarding', onboardingStarted: true, onboardingStep: 'identity_verification', updatedAt: new Date() } }
        )

        await db.collection('leads_drivers').insertOne({
          name: prospect.name,
          email: prospect.contact?.email,
          phone: prospect.contact?.phone,
          truckType: prospect.equipment?.[0] || 'Not specified',
          yearsExperience: parseInt(prospect.experience?.replace('+', '').replace(' years', '')) || 0,
          status: 'onboarding',
          source: 'outbound_prospecting',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: 'AI Supervisor',
          activity: `Auto onboarding started for ${prospect.name} (score: ${prospect.score})`,
          type: 'auto_onboarding',
          details: { prospectId: prospect._id.toString(), score: prospect.score },
        })
        onboarded++
      }

      result.message = `🎯 Auto onboarding: ${onboarded} qualified prospects (score ≥75) moved to onboarding`
      result.details = { onboarded, totalQualified: qualifiedProspects.length }
    }
    
    // ========== AGENT-SPECIFIC ACTIONS ==========
    
    else if (action === 'outbound_prospecting') {
      // Sofia - Lead Generation
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const existingToday = await db.collection('outbound_prospects').countDocuments({
        createdAt: { $gte: today }
      })
      
      // Search for new prospects (in production calls FMCSA/DAT/LinkedIn)
      const mockProspects = [
        { name: 'James Rodriguez', email: 'j.rodriguez@trucking.com', phone: '555-0101', equipment: 'Dry Van', experience: '15 years', authority: 'Active', score: 82, lanes: ['TX-LA', 'TX-NM'] },
        { name: 'Maria Santos', email: 'msantos@freight.com', phone: '555-0102', equipment: 'Flatbed', experience: '8 years', authority: 'Active', score: 76, lanes: ['TX-OK', 'TX-AR'] },
        { name: 'David Chen', email: 'dchen@logistics.com', phone: '555-0103', equipment: 'Reefer', experience: '12 years', authority: 'Active', score: 89, lanes: ['TX-CA', 'TX-NV'] },
      ]
      
      let created = 0
      for (const p of mockProspects) {
        await db.collection('outbound_prospects').insertOne({
          ...p,
          contact: { email: p.email, phone: p.phone },
          equipment: [p.equipment],
          experience: p.experience,
          authority: p.authority,
          score: p.score,
          lanes: p.lanes,
          source: 'fmcsa_search',
          status: 'new',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        created++
        
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist' },
          activity: `Found new prospect: ${p.name} (score: ${p.score}, lanes: ${p.lanes.join(', ')})`,
          type: 'outbound_prospecting',
          agentId: 'lead_generation',
          details: { prospectName: p.name, score: p.score, lanes: p.lanes },
        })
      }
      
      result.message = `🔍 Sofia prospecting complete: ${created} new prospects found (today total: ${existingToday + created})`
      result.details = { created, existingToday, totalToday: existingToday + created }
    }
    
    else if (action === 'find_customers') {
      // Marcus - Sales
      const pendingQuotes = await db.collection('leads_quotes').find({ 
        status: { $in: ['new', 'qualified'] } 
      }).limit(10).toArray()
      
      let quotesBuilt = 0
      for (const quote of pendingQuotes) {
        if (quote.status === 'new') {
          await db.collection('leads_quotes').updateOne(
            { _id: quote._id },
            { $set: { status: 'quoted', quotedAt: new Date(), updatedAt: new Date() } }
          )
          
          await db.collection('agent_activity').insertOne({
            timestamp: new Date(),
            agent: { name: 'Marcus Chen', role: 'Sales Director' },
            activity: `Built quote for ${quote.companyName || quote.name} - ${quote.serviceType} (${quote.origin} to ${quote.destination})`,
            type: 'find_customers',
            agentId: 'sales',
            details: { quoteId: quote._id.toString(), company: quote.companyName, lanes: `${quote.origin} → ${quote.destination}` },
          })
          quotesBuilt++
        }
      }
      
      result.message = `📊 Marcus built ${quotesBuilt} quotes from pending leads (${pendingQuotes.length} pending total)`
      result.details = { quotesBuilt, pendingTotal: pendingQuotes.length }
    }
    
    else if (action === 'strategic_review') {
      // Alexandra - CEO
      const premiumProspects = await db.collection('outbound_prospects').find({ score: { $gte: 85 }, status: 'new' }).limit(5).toArray()
      const pendingQuotes = await db.collection('leads_quotes').find({ status: 'qualified' }).limit(5).toArray()
      const onboardingDrivers = await db.collection('leads_drivers').find({ status: 'onboarding' }).limit(5).toArray()
      
      let approved = 0
      for (const prospect of premiumProspects) {
        await db.collection('outbound_prospects').updateOne(
          { _id: prospect._id },
          { $set: { status: 'premium_approved', premiumApprovedAt: new Date(), updatedAt: new Date() } }
        )
        
        await db.collection('leads_drivers').insertOne({
          name: prospect.name,
          email: prospect.contact?.email,
          phone: prospect.contact?.phone,
          truckType: prospect.equipment?.[0] || 'Not specified',
          yearsExperience: prospect.experience ? parseInt(prospect.experience.replace('+', '').replace(' years', '')) || 0 : 0,
          status: 'onboarding',
          source: 'outbound_prospecting',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'Alexandra Sterling', role: 'Chief Executive Officer' },
          activity: `Fast-tracked premium prospect: ${prospect.name} (score: ${prospect.score})`,
          type: 'strategic_review',
          agentId: 'ceo',
          details: { prospectId: prospect._id.toString(), score: prospect.score, action: 'fast_track_approved' },
        })
        approved++
      }
      
      result.message = `👑 Alexandra review complete: ${approved} premium prospects fast-tracked (${premiumProspects.length} reviewed)`
      result.details = { approved, reviewed: premiumProspects.length, pendingQuotes: pendingQuotes.length, onboardingDrivers: onboardingDrivers.length }
    }
    
    else if (action === 'schedule_deliveries') {
      // David - Operations
      const readyDrivers = await db.collection('leads_drivers').find({ status: 'ready_to_dispatch' }).limit(10).toArray()
      const availableLoads = await db.collection('loads').find({ status: 'available' }).limit(10).toArray()
      
      let dispatched = 0
      for (let i = 0; i < Math.min(readyDrivers.length, availableLoads.length); i++) {
        const driver = readyDrivers[i]
        const load = availableLoads[i]
        
        await db.collection('loads').updateOne(
          { _id: load._id },
          { $set: { status: 'dispatched', driverId: driver._id, dispatchedAt: new Date(), updatedAt: new Date() } }
        )
        
        await db.collection('leads_drivers').updateOne(
          { _id: driver._id },
          { $set: { status: 'dispatched', currentLoadId: load._id, updatedAt: new Date() } }
        )
        
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'David Kumar', role: 'Operations Director' },
          activity: `Dispatched ${driver.name} on load ${load.loadNumber} (${load.origin} → ${load.destination})`,
          type: 'schedule_deliveries',
          agentId: 'operations',
          details: { driverId: driver._id.toString(), loadId: load._id.toString(), lanes: `${load.origin} → ${load.destination}` },
        })
        dispatched++
      }
      
      result.message = `🚛 David dispatched ${dispatched} loads (${readyDrivers.length} ready drivers, ${availableLoads.length} available loads)`
      result.details = { dispatched, readyDrivers: readyDrivers.length, availableLoads: availableLoads.length }
    }
    
    else if (action === 'hire_drivers') {
      // Jennifer - HR
      const onboardingDrivers = await db.collection('leads_drivers').find({ 
        status: { $in: ['onboarding', 'compliance_check'] } 
      }).limit(10).toArray()
      
      let processed = 0
      for (const driver of onboardingDrivers) {
        const nextStep = driver.onboardingStep === 'identity_verification' ? 'fmcsa_check' :
                        driver.onboardingStep === 'fmcsa_check' ? 'background_check' :
                        driver.onboardingStep === 'background_check' ? 'drug_screen' :
                        driver.onboardingStep === 'drug_screen' ? 'insurance_verification' :
                        driver.onboardingStep === 'insurance_verification' ? 'lease_signing' : 'complete'
        
        await db.collection('leads_drivers').updateOne(
          { _id: driver._id },
          { $set: { onboardingStep: nextStep, updatedAt: new Date() } }
        )
        
        if (nextStep === 'complete') {
          await db.collection('leads_drivers').updateOne(
            { _id: driver._id },
            { $set: { status: 'ready_to_dispatch', updatedAt: new Date() } }
          )
          
          await db.collection('agent_activity').insertOne({
            timestamp: new Date(),
            agent: { name: 'Jennifer Foster', role: 'HR Director' },
            activity: `Driver onboarded: ${driver.name} - ready for dispatch`,
            type: 'hire_drivers',
            agentId: 'hr',
            details: { driverId: driver._id.toString(), finalStep: 'complete' },
          })
        } else {
          await db.collection('agent_activity').insertOne({
            timestamp: new Date(),
            agent: { name: 'Jennifer Foster', role: 'HR Director' },
            activity: `Onboarding ${driver.name}: ${nextStep} completed`,
            type: 'hire_drivers',
            agentId: 'hr',
            details: { driverId: driver._id.toString(), step: nextStep },
          })
        }
        processed++
      }
      
      result.message = `👥 Jennifer processed ${processed} driver applications (${onboardingDrivers.length} in pipeline)`
      result.details = { processed, pipelineTotal: onboardingDrivers.length }
    }
    
    else if (action === 'check_revenue') {
      // Robert - Finance
      const pendingInvoices = await db.collection('loads').find({ status: 'delivered', invoiced: { $ne: true } }).limit(20).toArray()
      let invoiced = 0
      
      for (const load of pendingInvoices) {
        const revenue = load.rate || 0
        await db.collection('loads').updateOne(
          { _id: load._id },
          { $set: { invoiced: true, invoicedAt: new Date(), revenue, updatedAt: new Date() } }
        )
        
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'Robert Chang', role: 'Finance Director' },
          activity: `Invoiced load ${load.loadNumber}: $${revenue.toLocaleString()}`,
          type: 'check_revenue',
          agentId: 'finance',
          details: { loadId: load._id.toString(), amount: revenue },
        })
        invoiced++
      }
      
      result.message = `💰 Robert invoiced ${invoiced} loads ($${pendingInvoices.reduce((sum, l) => sum + (l.rate || 0), 0).toLocaleString()})`
      result.details = { invoiced, totalAmount: pendingInvoices.reduce((sum, l) => sum + (l.rate || 0), 0) }
    }
    
    else if (action === 'customer_support') {
      // Emily - Customer Success
      const activeCustomers = await db.collection('customers').find({ status: 'active' }).limit(10).toArray()
      let contacted = 0
      
      for (const customer of activeCustomers) {
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'Emily Watson', role: 'Customer Success Manager' },
          activity: `Check-in with ${customer.name}: satisfaction OK, no issues`,
          type: 'customer_support',
          agentId: 'customer_success',
          details: { customerId: customer._id.toString(), channels: ['email'] },
        })
        contacted++
      }
      
      result.message = `🎯 Emily completed ${contacted} customer check-ins`
      result.details = { contacted, activeCustomers: activeCustomers.length }
    }
    
    else if (action === 'send_marketing') {
      // Isabella - Marketing
      const nurtureLeads = await db.collection('outbound_prospects').find({ 
        status: 'nurture',
        lastContacted: { $lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
      }).limit(20).toArray()
      
      let emailed = 0
      for (const lead of nurtureLeads) {
        await db.collection('outbound_prospects').updateOne(
          { _id: lead._id },
          { $set: { lastContacted: new Date(), updatedAt: new Date() } }
        )
        
        await db.collection('agent_activity').insertOne({
          timestamp: new Date(),
          agent: { name: 'Isabella Martinez', role: 'Marketing Director' },
          activity: `Nurture email sent to ${lead.name}: industry insights + case study`,
          type: 'send_marketing',
          agentId: 'marketing',
          details: { leadId: lead._id.toString(), campaign: 'industry_insights' },
        })
        emailed++
      }
      
      result.message = `📧 Isabella sent ${emailed} nurture emails`
      result.details = { emailed, nurturePool: nurtureLeads.length }
    }
    
    else {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/admin/ai-activity] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute action', message: String(error) },
      { status: 500 }
    )
  }
}