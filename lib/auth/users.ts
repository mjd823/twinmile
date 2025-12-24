import { ObjectId } from "mongodb";

import clientPromise from "@/lib/mongodb";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import type { UserRole } from "@/lib/auth/types";

export type UserDoc = {
  _id: ObjectId;
  email: string;
  role: UserRole;
  passwordSaltBase64: string;
  passwordHashBase64: string;
  mustChangePassword?: boolean;
  createdAt: Date;
};

export async function findUserByEmail(email: string) {
  if (!clientPromise) return null;
  const client = await clientPromise;
  const db = client.db();
  return db.collection<UserDoc>("users").findOne({ email: email.toLowerCase() });
}

export async function findUserById(id: unknown) {
  if (!clientPromise) return null;
  const client = await clientPromise;
  const db = client.db();

  const objectId =
    typeof id === "string" ? new ObjectId(id) : (id as ObjectId);

  return db.collection<UserDoc>("users").findOne({ _id: objectId });
}

export async function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  mustChangePassword?: boolean;
}) {
  if (!clientPromise) throw new Error("Database not configured");
  const client = await clientPromise;
  const db = client.db();

  const email = input.email.toLowerCase();
  const existing = await db.collection<UserDoc>("users").findOne({ email });
  if (existing) throw new Error("User already exists");

  const { saltBase64, hashBase64 } = hashPassword(input.password);

  const doc = {
    email,
    role: input.role,
    passwordSaltBase64: saltBase64,
    passwordHashBase64: hashBase64,
    mustChangePassword: input.mustChangePassword ?? false,
    createdAt: new Date(),
  };

  const result = await db.collection("users").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function setUserPassword(userId: ObjectId, newPassword: string) {
  if (!clientPromise) throw new Error("Database not configured");
  const client = await clientPromise;
  const db = client.db();

  const { saltBase64, hashBase64 } = hashPassword(newPassword);

  await db.collection<UserDoc>("users").updateOne(
    { _id: userId },
    {
      $set: {
        passwordSaltBase64: saltBase64,
        passwordHashBase64: hashBase64,
        mustChangePassword: false,
      },
    }
  );
}

export async function setMustChangePassword(userId: ObjectId, value: boolean) {
  if (!clientPromise) throw new Error("Database not configured");
  const client = await clientPromise;
  const db = client.db();
  await db
    .collection<UserDoc>("users")
    .updateOne({ _id: userId }, { $set: { mustChangePassword: value } });
}

export function verifyUserPassword(user: UserDoc, password: string) {
  return verifyPassword({
    password,
    saltBase64: user.passwordSaltBase64,
    hashBase64: user.passwordHashBase64,
  });
}
