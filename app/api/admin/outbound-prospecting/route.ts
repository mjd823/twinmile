import { NextRequest, NextResponse } from 'next/server';
import { BusinessAgentFactory } from '@/lib/business-organization';
import clientPromise from '@/lib/mongodb';

// Outbound Lead Generation API - triggers Sofia (Lead Generation Agent) to find owner-operators
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action = 'find_owner_operators',
      criteria = {},
      maxResults = 20,
      saveToDatabase = true
    } = body;

    if (!clientPromise) {
      throw new Error('Database not configured');
    }

    const client = await clientPromise;
    const db = client.db();

    // Initialize the AI agent organization
    const agents = BusinessAgentFactory.initializeOrganization();
    const leadGenAgent = agents.get('lead_generation');

    if (!leadGenAgent) {
      throw new Error('Lead Generation Agent not available');
    }

    // Define target criteria for owner-operators
    const targetCriteria = {
      role: 'owner_operator',
      equipment: ['power_only', 'hotshot', 'semi_truck', 'flatbed', 'reefer'],
      experience: '2+ years',
      locations: ['Houston, TX', 'Dallas, TX', 'San Antonio, TX', 'Austin, TX', 'Los Angeles, CA', 'New Orleans, LA', 'Atlanta, GA', 'Memphis, TN'],
      lanes: ['TX-LA', 'TX-CA', 'TX-GA', 'TX-TN', 'Regional TX', 'OTR'],
      authority: ['own_authority', 'lease_on'],
      // Custom criteria from request
      ...criteria
    };

    console.log(`🎯 Sofia Rodriguez initiating outbound prospecting for: ${JSON.stringify(targetCriteria)}`);

    // Execute lead generation with AI agent
    const result = await leadGenAgent.process({
      type: 'outbound_owner_operator_prospecting',
      action: 'find_and_qualify',
      criteria: targetCriteria,
      maxResults,
      instructions: `
        Find owner-operators and small fleet owners who would be a fit for Twin Mile LLC's power-only program.
        
        Target Profile:
        - Owner-operators with own tractor (no trailer needed)
        - 2+ years OTR/regional experience
        - Located in or running lanes through: Texas, Louisiana, California, Georgia, Tennessee
        - Currently leased to a carrier or running own authority
        - CDL-A with clean MVR
        - Looking for better pay (80% gross), consistent lanes, weekly pay
        
        Search Strategies:
        1. LinkedIn: "owner operator" AND ("power only" OR "hotshot" OR "lease on") AND location
        2. DAT/Load board forums and communities
        3. Trucking Facebook groups and forums
        4. FMCSA snapshot data for active authorities in target regions
        5. Industry publications and association directories
        6. Competitor driver reviews (identify dissatisfaction signals)
        
        Qualification Criteria:
        - Must have own tractor (power only focus)
        - Clean safety record
        - 2+ years verifiable experience
        - Currently active (not parked)
        - Open to new opportunities (watch for: "looking for", "seeking", "new opportunity", contract ending)
        
        Output Format: Return structured data for each prospect:
        {
          name: string,
          contact: {email?, phone?, linkedin?},
          location: string,
          equipment: string,
          experience: string,
          authorityStatus: 'own' | 'lease' | 'unknown',
          currentCarrier?: string,
          lanes: string[],
          interestSignals: string[],
          source: string,
          sourceUrl: string,
          score: number (0-100),
          notes: string
        }
      `
    });

    const prospects = result.content ?? '';
    
    // Parse and structure the results
    let structuredProspects = [];
    try {
      const jsonMatch = prospects.match(/\[[\s\S]*\]/) || prospects.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredProspects = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed JSON from AI response');
      } else {
        console.warn('⚠️ No JSON array found in AI response, falling back to text parsing');
        structuredProspects = parseProspectsFromText(prospects);
      }
    } catch (parseError) {
      console.error('❌ JSON parse failed, falling back to text parsing:', parseError);
      try {
        structuredProspects = parseProspectsFromText(prospects);
      } catch (textParseError) {
        console.error('❌ Text parsing also failed:', textParseError);
        structuredProspects = [];
      }
    }

    // Enrich and score each prospect
    const enrichedProspects = structuredProspects.map((p: any, index: number) => ({
      id: `outbound_${Date.now()}_${index}`,
      name: p.name || `Prospect ${index + 1}`,
      contact: p.contact || {},
      location: p.location || 'Unknown',
      equipment: p.equipment || 'Not specified',
      experience: p.experience || 'Not specified',
      authorityStatus: p.authorityStatus || 'unknown',
      currentCarrier: p.currentCarrier || 'Not disclosed',
      lanes: p.lanes || [],
      interestSignals: p.interestSignals || [],
      source: p.source || 'AI Outbound Prospecting',
      sourceUrl: p.sourceUrl || '',
      aiScore: p.score || 50,
      aiAnalysis: p.notes || '',
      status: 'new',
      type: 'outbound_driver',
      createdAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
    }));

    // Save to database if requested
    let savedCount = 0;
    if (saveToDatabase && enrichedProspects.length > 0) {
      // Check for duplicates (by name + location + equipment)
      const existingProspects = await db.collection('outbound_prospects')
        .find({ 
          $or: enrichedProspects.map((p: any) => ({
            name: p.name,
            location: p.location,
            equipment: p.equipment
          }))
        })
        .toArray();

      const existingKeys = new Set(
        existingProspects.map(p => `${p.name}|${p.location}|${p.equipment}`.toLowerCase())
      );

      const newProspects = enrichedProspects.filter((p: any) => 
        !existingKeys.has(`${p.name}|${p.location}|${p.equipment}`.toLowerCase())
      );

      if (newProspects.length > 0) {
        const result = await db.collection('outbound_prospects').insertMany(newProspects);
        savedCount = result.insertedCount;
      }
    }

    // Log agent activity
    try {
      await db.collection('agent_activity').insertOne({
        action: 'outbound_prospecting',
        agent: { name: 'Sofia Rodriguez', role: 'Lead Generation Specialist', department: 'Sales' },
        result: {
          prospectsFound: enrichedProspects.length,
          prospectsSaved: savedCount,
          criteria: targetCriteria,
        },
        success: true,
        createdAt: new Date(),
      });
    } catch (logErr) {
      console.error('Failed to log agent activity:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: `🎯 Sofia Rodriguez completed outbound prospecting`,
      data: {
        prospectsFound: enrichedProspects.length,
        prospectsSaved: savedCount,
        prospects: enrichedProspects,
        criteria: targetCriteria,
        agent: 'Sofia Rodriguez (Lead Generation Specialist)',
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Outbound lead generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET endpoint to retrieve outbound prospects
export async function GET(request: NextRequest) {
  try {
    if (!clientPromise) {
      throw new Error('Database not configured');
    }

    const client = await clientPromise;
    const db = client.db();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const query: Record<string, any> = {};
    if (status) query.status = status;

    const [prospects, total] = await Promise.all([
      db.collection('outbound_prospects')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      db.collection('outbound_prospects').countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: prospects.map(p => ({
        ...p,
        _id: p._id.toString(),
      })),
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Get outbound prospects error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Helper function to parse prospects from unstructured text
function parseProspectsFromText(text: string) {
  const prospects = [];
  const lines = text.split('\n');
  let currentProspect: Record<string, any> = {};
  
  for (const line of lines) {
    if (!line || typeof line !== 'string') continue;
    const lower = line.toLowerCase();
    
    if (lower.includes('name:') || (lower.includes('prospect') && lower.includes(':'))) {
      if (Object.keys(currentProspect).length > 0) {
        prospects.push(currentProspect);
      }
      const namePart = line.split(':')[1];
      currentProspect = { name: namePart ? namePart.trim() : 'Unknown' };
    } else if (lower.includes('location:')) {
      const val = line.split(':')[1];
      currentProspect.location = val ? val.trim() : 'Unknown';
    } else if (lower.includes('equipment:') || lower.includes('truck:')) {
      const val = line.split(':')[1];
      currentProspect.equipment = val ? val.trim() : 'Not specified';
    } else if (lower.includes('experience:')) {
      const val = line.split(':')[1];
      currentProspect.experience = val ? val.trim() : 'Not specified';
    } else if (lower.includes('authority:') || lower.includes('authority status:')) {
      const val = line.split(':')[1];
      currentProspect.authorityStatus = val ? val.trim() : 'unknown';
    } else if (lower.includes('carrier:') || lower.includes('current carrier:')) {
      const val = line.split(':')[1];
      currentProspect.currentCarrier = val ? val.trim() : 'Not disclosed';
    } else if (lower.includes('lanes:')) {
      const val = line.split(':')[1];
      currentProspect.lanes = val ? val.split(',').map(s => s.trim()) : [];
    } else if (lower.includes('signal:') || lower.includes('interest:')) {
      const val = line.split(':')[1];
      currentProspect.interestSignals = val ? val.split(',').map(s => s.trim()) : [];
    } else if (lower.includes('source:')) {
      const val = line.split(':')[1];
      currentProspect.source = val ? val.trim() : 'AI Outbound Prospecting';
    } else if (lower.includes('url:') || lower.includes('link:')) {
      const val = line.split(':')[1];
      currentProspect.sourceUrl = val ? val.trim() : '';
    } else if (lower.includes('score:')) {
      const val = line.split(':')[1];
      currentProspect.score = val ? parseInt(val.trim()) : 50;
    } else if (lower.includes('note:')) {
      const val = line.split(':')[1];
      currentProspect.notes = val ? val.trim() : '';
    }
  }
  
  if (Object.keys(currentProspect).length > 0) {
    prospects.push(currentProspect);
  }
  
  return prospects.length > 0 ? prospects : [];
}