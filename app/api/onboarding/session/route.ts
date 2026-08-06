import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

/** How far a self-renewal pushes the expiry out — matches lib/autoheal.ts. */
const SESSION_RENEWAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Beyond this age from creation, a click no longer silently reopens the session.
 * Not a security boundary (the token only unlocks the holder's own prefilled
 * data) — it stops an ancient link from being resurrected years later against
 * terms and pay figures that have since changed.
 */
const SELF_RENEW_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * GET /api/onboarding/session?token=XXX
 *
 * Validates an onboarding token and returns the session data including
 * pre-filled form data. This allows prospects to resume their onboarding
 * where they left off — no login required until the final step.
 *
 * The token is the rawToken stored in the onboarding_sessions collection.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing onboarding token. Please use the link from your invitation email." },
        { status: 400 }
      );
    }

    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Find the session by rawToken
    const session = await db.collection("onboarding_sessions").findOne({ rawToken: token });

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired onboarding link. Please request a new invitation." },
        { status: 404 }
      );
    }

    // Register that the prospect clicked the link (track first click and last active)
    const now = new Date();
    const updateData: any = {
      lastActiveAt: now,
      updatedAt: now,
    };

    // Only set firstClickedAt if this is the first time they're accessing
    if (!session.firstClickedAt) {
      updateData.firstClickedAt = now;
      updateData.status = session.status === "pending" ? "started" : session.status;

      // Log the click as agent activity (Jennifer Foster / HR tracks this)
      try {
        await db.collection("agent_activity").insertOne({
          action: "onboarding_link_clicked",
          agent: { name: "Jennifer Foster", role: "HR Director", department: "HR" },
          result: {
            leadName: session.name,
            leadEmail: session.email,
            sessionToken: token.substring(0, 8) + "...",
            firstClick: true,
          },
          success: true,
          createdAt: now,
        });
      } catch (logErr) {
        console.error("[onboarding/session] Failed to log click:", logErr);
      }
    }

    await db.collection("onboarding_sessions").updateOne(
      { _id: session._id },
      { $set: updateData }
    );

    // EXPIRED — but recoverable.
    //
    // This branch used to be a terminal 410 ("contact us for a new link"), which
    // is a wall in front of the most valuable event this funnel has: a prospect
    // who finally clicked. 956 of 962 invitees were behind it. lib/autoheal.ts
    // already renews any session that has been clicked, to 30 days — so the only
    // thing the wall accomplished was making the person wait up to an hour for a
    // cron to do what we can do right here, at the moment of engagement.
    //
    // The SAME session and the SAME token are extended rather than rotated: the
    // link lives in an email we cannot edit, and rotating would break the copy
    // the prospect is holding. The expiry is not a security control here — the
    // token only unlocks the prospect's own prefilled data — but self-renewal is
    // still bounded, so a token cannot be resurrected indefinitely.
    if (session.expiresAt && new Date(session.expiresAt) < now) {
      const createdAt = session.createdAt ? new Date(session.createdAt) : null;
      const ageMs = createdAt ? now.getTime() - createdAt.getTime() : Number.POSITIVE_INFINITY;

      if (ageMs <= SELF_RENEW_MAX_AGE_MS) {
        await db.collection("onboarding_sessions").updateOne(
          { _id: session._id },
          {
            $set: {
              expiresAt: new Date(now.getTime() + SESSION_RENEWAL_MS),
              renewedAt: now,
              renewedBy: "self-click",
              updatedAt: now,
            },
          }
        );
      } else {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This onboarding link is too old to reopen. Call (281) 710-7787 or reply to your invitation email and we will send a fresh one — nothing you entered is lost.",
            expired: true,
          },
          { status: 410 }
        );
      }
    }

    // Check if already completed
    if (session.status === "completed") {
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        message: "You've already completed onboarding.",
      });
    }

    // Return session data for pre-filling
    return NextResponse.json({
      ok: true,
      session: {
        leadName: session.name,
        leadEmail: session.email,
        leadType: session.leadType,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        preFilledData: session.preFilledData || {},
        aiScore: session.metadata?.aiScore,
        currentStep: session.currentStep || 1, // Resume from saved step
        formData: session.formData || {},
      },
    });
  } catch (error) {
    console.error("[onboarding/session] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to validate onboarding session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/onboarding/session?token=XXX
 *
 * Saves progress so the prospect can resume where they left off.
 * Updates currentStep and formData in the session.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { currentStep, formData } = body;

    const client = await clientPromise;
    const db = client.db();

    const result = await db.collection("onboarding_sessions").updateOne(
      { rawToken: token },
      {
        $set: {
          currentStep: currentStep,
          formData: formData,
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[onboarding/session] PATCH Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to save progress" }, { status: 500 });
  }
}