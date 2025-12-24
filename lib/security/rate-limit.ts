import clientPromise from "@/lib/mongodb";

type RateLimitDoc = {
  _id: string;
  count: number;
  resetAt: Date;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: Date;
};

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (!clientPromise) {
    return {
      ok: true,
      remaining: opts.limit,
      resetAt: new Date(Date.now() + opts.windowMs),
    };
  }

  const client = await clientPromise;
  const db = client.db();
  const col = db.collection<RateLimitDoc>("rateLimits");

  const now = new Date();
  const doc = await col.findOne({ _id: opts.key });

  if (!doc || !(doc.resetAt instanceof Date) || doc.resetAt.getTime() <= now.getTime()) {
    const resetAt = new Date(now.getTime() + opts.windowMs);
    await col.updateOne(
      { _id: opts.key },
      { $set: { count: 1, resetAt } },
      { upsert: true }
    );

    return {
      ok: true,
      remaining: Math.max(0, opts.limit - 1),
      resetAt,
    };
  }

  await col.updateOne({ _id: opts.key }, { $inc: { count: 1 } });
  const updated = await col.findOne({ _id: opts.key });

  const nextCount = updated?.count ?? (doc.count + 1);
  const remaining = Math.max(0, opts.limit - nextCount);

  return {
    ok: nextCount <= opts.limit,
    remaining,
    resetAt: updated?.resetAt ?? doc.resetAt,
  };
}
