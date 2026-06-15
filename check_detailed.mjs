import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  
  // Check qualified leads in leads_quotes in detail
  const qualifiedQuotes = await db.collection('leads_quotes').find({ status: 'qualified' }).toArray();
  console.log('=== Qualified quotes (detailed) ===');
  for (const q of qualifiedQuotes) {
    console.log(JSON.stringify(q, null, 2));
  }
  
  // Check all leads_drivers
  const drivers = await db.collection('leads_drivers').find({}).toArray();
  console.log('=== All drivers (detailed) ===');
  for (const d of drivers) {
    console.log(JSON.stringify(d, null, 2));
  }
  
  // Check outbound_prospects with status updated
  const prospects = await db.collection('outbound_prospects').find({ status: { $in: ['qualified', 'proposal_sent'] } }).toArray();
  console.log('=== Qualified/Proposal sent prospects ===');
  for (const p of prospects) {
    console.log(JSON.stringify(p, null, 2));
  }
  
  await client.close();
}
check().catch(console.error);