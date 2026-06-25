import { MongoClient, MongoClientOptions } from 'mongodb';

import { ensureIndexes } from "@/lib/security/indexes";

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  appName: "twinmile-web",
  connectTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  serverSelectionTimeoutMS: 60000,
  maxPoolSize: 5,
  minPoolSize: 1,
  maxIdleTimeMS: 60000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib'],
};

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

if (uri) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect()
        .catch(err => {
          console.error('MongoDB connection failed, retrying...', err.message);
          // Wait 2 seconds and retry once
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              client.connect()
                .then(resolve)
                .catch(reject);
            }, 2000);
          });
        });
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect()
      .catch(err => {
        console.error('MongoDB connection failed, retrying...', err.message);
        // Wait 2 seconds and retry once
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            client.connect()
              .then(resolve)
              .catch(reject);
          }, 2000);
        });
      });
  }
}

if (clientPromise) {
  clientPromise
    .then((c) => ensureIndexes(c.db()))
    .catch(() => {
      // ignore
    });
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;