const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const drivers = await db.collection('drivers').find({}).toArray();
  console.log('=== drivers ===', drivers.length);
  drivers.forEach(d => console.log(d.fullName || d.name, d.email, d.status));

  const leases = await db.collection('leases').find({}).toArray();
  console.log('\n=== leases ===', leases.length);
  leases.forEach(d => console.log(d.id || d._id, d.driverName || d.name, d.status));

  for (const coll of ['fuel_logs', 'maintenance_logs', 'route_events']) {
    const count = await db.collection(coll).countDocuments();
    console.log(`\n${coll}:`, count);
    if (count > 0) {
      const docs = await db.collection(coll).find({}).limit(3).toArray();
      docs.forEach(d => console.log(JSON.stringify(d).substring(0, 200)));
    }
  }

  await client.close();
}
check().catch(console.error);