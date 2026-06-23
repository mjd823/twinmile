import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI not configured');
  process.exit(1);
}

const client = new MongoClient(uri);

async function runDailyOps() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();

    // Run daily AI operations
    const [prospects, outreachTasks, driverLeads] = await Promise.all([
      db.collection('outbound_prospects').find({ status: 'new' }).limit(10).toArray(),
      db.collection('outreach_tasks').find({ status: { $in: ['pending', 'retrying'] } }).limit(20).toArray(),
      db.collection('leads_drivers').find({ status: 'new' }).limit(10).toArray(),
    ]);

    // Log activity
    await db.collection('agent_activity').insertOne({
      timestamp: new Date(),
      agent: 'AI Supervisor',
      activity: `Daily ops: ${prospects.length} new prospects, ${outreachTasks.length} pending outreach, ${driverLeads.length} new driver leads`,
      type: 'daily_ops',
      details: { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length },
    });

    const message = `✅ Daily operations complete: ${prospects.length} prospects, ${outreachTasks.length} outreach tasks, ${driverLeads.length} driver leads queued`;
    console.log(message);
    console.log('Details:', { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length });
    
    return { success: true, message, details: { prospects: prospects.length, outreachTasks: outreachTasks.length, driverLeads: driverLeads.length } };
  } catch (error) {
    console.error('Failed to execute daily_ops:', error);
    return { success: false, error: 'Failed to execute action', message: String(error) };
  } finally {
    await client.close();
  }
}

runDailyOps().then(result => {
  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
});