import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  const prospects = await db.collection('outbound_prospects').find({}).toArray();
  const drivers = await db.collection('leads_drivers').find({}).toArray();
  const quotes = await db.collection('leads_quotes').find({}).toArray();
  
  console.log('=== outbound_prospects ===');
  for (const p of prospects) {
    console.log(`  ${p.name} (${p.email}) - status: ${p.status}, score: ${p.score || p.aiScore}, onboardingToken: ${p.onboardingToken ? 'yes' : 'no'}`);
  }
  
  console.log('=== leads_drivers ===');
  for (const d of drivers) {
    console.log(`  ${d.name} (${d.email}) - status: ${d.status}, score: ${d.score || d.aiScore}, onboardingToken: ${d.onboardingToken ? 'yes' : 'no'}`);
  }
  
  console.log('=== leads_quotes ===');
  for (const q of quotes) {
    console.log(`  ${q.name} (${q.email}) - status: ${q.status}, score: ${q.score || q.aiScore}, onboardingToken: ${q.onboardingToken ? 'yes' : 'no'}`);
  }
  
  await client.close();
}
check().catch(console.error);