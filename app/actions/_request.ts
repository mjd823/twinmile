"use server";

import { headers } from "next/headers";

export async function getClientIpFromHeaders(): Promise<string> {
  const h = await headers();
  const xfwd = h.get("x-forwarded-for");
  if (xfwd) {
    const first = xfwd.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = h.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export async function getUserAgentFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("user-agent") ?? "";
}

export async function isSameOriginFromHeaders(): Promise<boolean> {
  const h = await headers();

  const origin = h.get("origin");
  const referer = h.get("referer");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  const candidate = origin ?? (referer ? new URL(referer).origin : null);
  if (!candidate) return true;
  if (!host) return false;

  const expected = `${proto}://${host}`;
  return candidate === expected;
}
