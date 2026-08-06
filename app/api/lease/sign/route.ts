import { NextRequest, NextResponse } from "next/server";

import clientPromise from "@/lib/mongodb";
import { isSameOrigin } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { LEASE_TERMS_VERSION } from "@/lib/lease-terms";

/**
 * POST /api/lease/sign — record the signature for a deferred Lease-On Agreement.
 *
 * AUTHORIZATION is the signingToken itself: a 32-byte random capability minted
 * per lease record in /api/onboarding/complete and delivered only to the
 * applicant's own email address. Same model as the onboarding session token and
 * the one-click unsubscribe link, and for the same reason — an applicant who
 * deferred signing has no account password yet, so requiring a login would
 * recreate the dead end this whole path exists to remove.
 *
 * What the token can do is deliberately tiny: it moves ONE lease record from
 * awaiting_signature to pending_review and writes a signature onto it. It cannot
 * read documents, cannot touch the user record, cannot re-sign an already-signed
 * lease, and is consumed on use (signingToken is unset), so a forwarded email
 * cannot be replayed.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rl = await rateLimit({ key: `lease-sign:ip:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: "Database not configured." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const signature =
      typeof body?.signature === "string" ? body.signature.trim().slice(0, 200) : "";
    const consent = body?.consent === true;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing signing link." }, { status: 400 });
    }
    if (signature.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Type your full legal name to sign." },
        { status: 400 }
      );
    }
    if (!consent) {
      return NextResponse.json(
        { ok: false, error: "Please confirm you agree to the terms." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    // Atomic: the status guard is IN the filter, so a double-tap on a phone (or a
    // forwarded link) cannot produce two signatures on one lease.
    const updated = await db.collection("lease_agreements").findOneAndUpdate(
      { signingToken: token, status: "awaiting_signature" },
      {
        $set: {
          status: "pending_review",
          signature,
          signedAt: now,
          signedVia: "emailed_link",
          signedIp: ip,
          termsVersion: LEASE_TERMS_VERSION,
          updatedAt: now,
        },
        // Consume the capability. Signing is a one-time act; leaving a live token
        // on a signed lease is a replay waiting to happen.
        $unset: { signingToken: "" },
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      // Either an unknown token or a lease that is already signed. Both are
      // reported the same way on purpose — distinguishing them would let someone
      // probe for valid tokens.
      return NextResponse.json(
        { ok: false, error: "This signing link is no longer valid. Reply to your agreement email." },
        { status: 404 }
      );
    }

    // Clear the deferral off the driver record so the follow-up list stops
    // showing a gap that is now closed.
    if (updated.userId) {
      await db.collection("users").updateOne(
        { _id: updated.userId },
        {
          $unset: { "deferredItems.leaseSignature": "" },
          $set: { leaseSignedAt: now, updatedAt: now },
        }
      );
    }

    await db.collection("agent_activity").insertOne({
      timestamp: now,
      createdAt: now,
      agent: { name: "Onboarding Portal", role: "System" },
      activity: `Lease-On Agreement signed by ${updated.operatorName || updated.operatorEmail} via emailed link`,
      action: "lease_signed",
      type: "lease_signed",
      success: true,
      details: {
        leaseId: String(updated._id),
        operatorEmail: updated.operatorEmail || "",
        termsVersion: LEASE_TERMS_VERSION,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/lease/sign] error:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
