const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function cleanup() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log('=== CLEANUP START ===\n');

  // 1. Delete all trucks (mock data)
  const trucksResult = await db.collection('trucks').deleteMany({});
  console.log(`Deleted ${trucksResult.deletedCount} trucks`);

  // 2. Delete all loads (mock data)
  const loadsResult = await db.collection('loads').deleteMany({});
  console.log(`Deleted ${loadsResult.deletedCount} loads`);

  // 3. Clean leads_drivers - keep only Kenny Lane (real), delete 4 fake @email.com
  // First, show what we're deleting
  const fakeDrivers = await db.collection('leads_drivers').find({ 
    email: { $regex: '@email\\.com$' } 
  }).toArray();
  console.log(`\nFound ${fakeDrivers.length} fake drivers to delete:`);
  fakeDrivers.forEach(d => console.log(`  - ${d.fullName} (${d.email})`));

  const deleteResult = await db.collection('leads_drivers').deleteMany({ 
    email: { $regex: '@email\\.com$' } 
  });
  console.log(`Deleted ${deleteResult.deletedCount} fake driver leads`);

  // Verify Kenny Lane remains
  const realDrivers = await db.collection('leads_drivers').find({}).toArray();
  console.log(`\nRemaining drivers (${realDrivers.length}):`);
  realDrivers.forEach(d => console.log(`  - ${d.fullName} (${d.email}) - ${d.status}`));

  // 4. Verify other collections untouched
  const counts = {
    customers: await db.collection('customers').countDocuments(),
    contracts: await db.collection('contracts').countDocuments(),
    leads_quotes: await db.collection('leads_quotes').countDocuments(),
    outbound_prospects: await db.collection('outbound_prospects').countDocuments(),
    agent_activity: await db.collection('agent_activity').countDocuments(),
  };
  console.log('\n=== VERIFICATION - Collections preserved ===');
  Object.entries(counts).forEach(([k, v]) => console.log(`${k}: ${v}`));

  await client.close();
  console.log('\n=== CLEANUP COMPLETE ===');
}
cleanup().catch(console.error);