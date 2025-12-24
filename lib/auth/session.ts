import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { randomToken, sha256Base64Url } from "@/lib/auth/crypto";
import type { AuthUser, UserRole } from "@/lib/auth/types";

const COOKIE_NAME = "tm_session";
const ROLE_COOKIE = "tm_role";
const MUST_CHANGE_PASSWORD_COOKIE = "tm_mcpw";

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function createSession(input: {
  userId: ObjectId;
  role: UserRole;
  ttlDays?: number;
  mustChangePassword?: boolean;
}) {
  if (!clientPromise) throw new Error("Database not configured");

  const ttlDays = input.ttlDays ?? 14;
  const token = randomToken(32);
  const tokenHash = sha256Base64Url(token);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const client = await clientPromise;
  const db = client.db();

  await db.collection("sessions").insertOne({
    userId: input.userId,
    tokenHash,
    role: input.role,
    createdAt: now,
    expiresAt,
  });

  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  jar.set({
    name: ROLE_COOKIE,
    value: input.role,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  jar.set({
    name: MUST_CHANGE_PASSWORD_COOKIE,
    value: input.mustChangePassword ? "1" : "0",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token && clientPromise) {
    const tokenHash = sha256Base64Url(token);
    try {
      const client = await clientPromise;
      const db = client.db();
      await db.collection("sessions").deleteOne({ tokenHash });
    } catch {
      // ignore
    }
  }

  jar.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  jar.set({
    name: ROLE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  jar.set({
    name: MUST_CHANGE_PASSWORD_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!clientPromise) return null;

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = sha256Base64Url(token);

  const client = await clientPromise;
  const db = client.db();

  const session = await db.collection("sessions").findOne({ tokenHash });
  if (!session) return null;

  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    await db.collection("sessions").deleteOne({ _id: session._id });
    return null;
  }

  const user = await db
    .collection("users")
    .findOne(
      { _id: new ObjectId(session.userId) },
      { projection: { email: 1, firstName: 1, lastName: 1, isOwnerOperator: 1, role: 1, mustChangePassword: 1 } }
    );

  if (!user) return null;

  return {
    _id: user._id,
    email: String(user.email),
    firstName: (user as any).firstName ? String((user as any).firstName) : undefined,
    lastName: (user as any).lastName ? String((user as any).lastName) : undefined,
    isOwnerOperator: Boolean((user as any).isOwnerOperator),
    role: user.role as UserRole,
    mustChangePassword: Boolean((user as any).mustChangePassword),
  };
}

export async function requireRole(role: UserRole) {
  const user = await getAuthUser();
  if (!user) return null;
  if (user.role !== role) return null;
  return user;
}
