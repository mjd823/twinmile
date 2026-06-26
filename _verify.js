const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf8');
const match = content.match(/MONGODB_URI=mongodb\+srv:\/\/([^:]+):([^@]+)@(.+)/);
const user = match[1];
const pass = match[2].trim();
const host = match[3].trim();
const fullUri = `mongodb+srv://${user}:${pass}@${host}`;

const { MongoClient } = require('mongodb');
const client = new MongoClient(fullUri);

async function run() {
  await client.connect();
  const db = client.db();
  const lastSupervisor = await db.collection('agent_activity').find({ action: 'supervisor_monitoring' }).sort({ createdAt: -1 }).limit(2).toArray();
  console.log('Last 2 supervisor monitoring entries:');
  lastSupervisor.forEach(e => {
    console.log(' -', e.createdAt, '| success:', e.success, '| agentsMonitored:', e.result?.agentsMonitored, '| pipeline total:', e.result?.pipeline?.totalProspects);
  });
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
