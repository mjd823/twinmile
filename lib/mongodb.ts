import { MongoClient, MongoClientOptions } from 'mongodb';

import { ensureIndexes } from "@/lib/security/indexes";

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  appName: "twinmile-web",
  connectTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  serverSelectionTimeoutMS: 30000,
  maxPoolSize: 5,
  minPoolSize: 1,
  maxIdleTimeMS: 60000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib'],
};

/**
 * Self-healing connection cache.
 *
 * The previous implementation cached `client.connect()` at module scope; if
 * both the initial attempt and its single retry failed (e.g. a transient
 * MongoNetworkError on a cold serverless instance), the module held a
 * PERMANENTLY REJECTED promise. Every later request in that lambda —
 * including /admin/login — then failed until the instance was recycled,
 * which is exactly the "entire admin kept erroring" incident of 2026-07-08
 * (error digest 1977713650).
 *
 * Now the cache is cleared whenever a connection attempt fails, so the next
 * request triggers a fresh connect instead of replaying the old rejection.
 */
interface MongoCache {
  promise: Promise<MongoClient> | null;
}

const globalWithMongo = global as typeof globalThis & {
  _twinmileMongoCache?: MongoCache;
};

// In development, keep the cache on `global` so HMR module reloads reuse the
// same connection. In production each lambda gets its own module scope.
const cache: MongoCache =
  process.env.NODE_ENV === 'development'
    ? (globalWithMongo._twinmileMongoCache ??= { promise: null })
    : { promise: null };

function connect(): Promise<MongoClient> {
  if (!cache.promise) {
    const client = new MongoClient(uri!, options);
    cache.promise = client
      .connect()
      .then((connected) => {
        // Fire-and-forget: indexes are best-effort and must never block or
        // poison the connection promise.
        ensureIndexes(connected.db()).catch(() => {});
        return connected;
      })
      .catch((err) => {
        console.error('MongoDB connection failed (will retry on next request):', err?.message ?? err);
        // Do NOT cache the rejection — the next caller gets a fresh attempt.
        cache.promise = null;
        client.close().catch(() => {});
        throw err;
      });
  }
  return cache.promise;
}

/**
 * Promise-compatible facade so existing `await clientPromise` call sites keep
 * working unchanged, while every await goes through the self-healing cache.
 */
const clientPromise: Promise<MongoClient> | null = uri
  ? ({
      then: (onfulfilled?: any, onrejected?: any) => connect().then(onfulfilled, onrejected),
      catch: (onrejected?: any) => connect().catch(onrejected),
      finally: (onfinally?: any) => connect().finally(onfinally),
      [Symbol.toStringTag]: 'Promise',
    } as Promise<MongoClient>)
  : null;

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
