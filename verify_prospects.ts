require('dotenv').config({path: '.env.local'});

async function verifyProspects() {
  try {
    const clientPromise = (await import('./lib/mongodb')).default;
    const client = await clientPromise;
    const db = client.db();
    
    const prospects = await db.collection('outbound_prospects')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    console.log(`Total outbound prospects in database: ${prospects.length}`);
    console.log('\nRecent prospects:');
    prospects.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.name} - ${p.location} - ${p.equipment} (Score: ${p.aiScore}) [${p.status}]`);
      console.log(`     Source: ${p.source}`);
      console.log(`     Created: ${p.createdAt}`);
      console.log('');
    });
    
    // Also check agent activity logs
    const activities = await db.collection('agent_activity')
      .find({ action: 'outbound_prospecting' })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    console.log(`\nAgent activity logs for outbound_prospecting: ${activities.length}`);
    activities.forEach((a, i) => {
      console.log(`  ${i+1}. ${a.agent.name} - Found: ${a.result.prospectsFound}, Saved: ${a.result.prospectsSaved} - ${a.createdAt}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyProspects();