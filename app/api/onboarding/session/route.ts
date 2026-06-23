import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

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

    // Check if expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { ok: false, error: "This onboarding link has expired. Please contact us for a new link.", expired: true },
        { status: 410 }
      );
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