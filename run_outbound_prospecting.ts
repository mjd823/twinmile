require('dotenv').config({path: '.env.local'});

// Import the environment
process.env.NODE_ENV = 'production';

// We'll use dynamic imports for the TypeScript modules
async function runOutboundProspecting() {
  try {
    console.log('🚀 Starting outbound prospecting...');
    
    // Import the necessary modules
    const { BusinessAgentFactory } = await import('./lib/business-organization.ts');
    const clientPromise = (await import('./lib/mongodb.ts')).default;
    
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
    
    const maxResults = 30;
    
    // Define target criteria for owner-operators
    const targetCriteria = {
      role: 'owner_operator',
      equipment: ['power_only', 'hotshot', 'semi_truck', 'flatbed', 'reefer'],
      experience: '2+ years',
      locations: ['Houston, TX', 'Dallas, TX', 'San Antonio, TX', 'Austin, TX', 'Los Angeles, CA', 'New Orleans, LA', 'Atlanta, GA', 'Memphis, TN'],
      lanes: ['TX-LA', 'TX-CA', 'TX-GA', 'TX-TN', 'Regional TX', 'OTR'],
      authority: ['own_authority', 'lease_on'],
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
    console.log('Raw AI response received, length:', prospects.length);
    
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
    const enrichedProspects = structuredProspects.map((p, index) => ({
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
    
    // Save to database
    let savedCount = 0;
    if (enrichedProspects.length > 0) {
      // Check for duplicates (by name + location + equipment)
      const existingProspects = await db.collection('outbound_prospects')
        .find({ 
          $or: enrichedProspects.map((p) => ({
            name: p.name,
            location: p.location,
            equipment: p.equipment
          }))
        })
        .toArray();
      
      const existingKeys = new Set(
        existingProspects.map(p => `${p.name}|${p.location}|${p.equipment}`.toLowerCase())
      );
      
      const newProspects = enrichedProspects.filter((p) => 
        !existingKeys.has(`${p.name}|${p.location}|${p.equipment}`.toLowerCase())
      );
      
      if (newProspects.length > 0) {
        const result = await db.collection('outbound_prospects').insertMany(newProspects);
        savedCount = result.insertedCount;
        console.log(`💾 Saved ${savedCount} new prospects to database`);
      } else {
        console.log('ℹ️ All prospects already exist in database (duplicates filtered)');
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
      console.log('📝 Agent activity logged');
    } catch (logErr) {
      console.error('Failed to log agent activity:', logErr);
    }
    
    console.log('\n✅ Outbound prospecting completed!');
    console.log(`   Prospects found: ${enrichedProspects.length}`);
    console.log(`   Prospects saved: ${savedCount}`);
    
    if (enrichedProspects.length > 0) {
      console.log('\nProspects:');
      enrichedProspects.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.name} - ${p.location} - ${p.equipment} (Score: ${p.aiScore})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Outbound prospecting failed:', error);
    process.exit(1);
  }
}

// Helper function to parse prospects from unstructured text
function parseProspectsFromText(text) {
  const prospects = [];
  const lines = text.split('\n');
  let currentProspect = {};
  
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

runOutboundProspecting();