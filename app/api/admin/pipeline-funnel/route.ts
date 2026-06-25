import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getPipelineFunnelData } from "@/lib/admin-pipeline-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/pipeline-funnel
 * Returns live pipeline funnel data from the single source of truth:
 * outbound_prospects → onboarding_sessions → lease_agreements.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getPipelineFunnelData();
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("[pipeline-funnel] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline data" },
      { status: 500 },
    );
  }
}
