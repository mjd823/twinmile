import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import clientPromise from "@/lib/mongodb";
import { getPipelineCounts } from "@/lib/pipeline-stages";

/**
 * POST /api/admin/supervisor/chat
 * Chat endpoint for the AI Supervisor.
 * Accepts a question from the admin and returns a data-driven answer
 * by querying MongoDB directly (no LLM needed — fast and accurate).
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const message = body?.message?.toLowerCase().trim();
    if (!message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    if (!clientPromise) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();

    let response = "";

    // Pipeline status queries — answered from the SAME canonical counts the
    // screens render (lib/pipeline-stages), so the chat can never contradict
    // the Recruiting Pipeline page or the hub.
    if (message.includes("pipeline") || message.includes("status") || message.includes("overview")) {
      const counts = await getPipelineCounts(db);
      const funnelLines = counts.stages
        .map(
          (s) =>
            `• ${s.label}: **${s.reached.toLocaleString()}** reached · ${s.inStage.toLocaleString()} ${s.inStageLabel} now${s.anomaly ? " ⚠️ anomaly" : ""}`
        )
        .join("\n");
      const awaitingInvite = counts.stages.find((s) => s.key === "qualified")?.inStage ?? 0;
      const engaged = counts.stages.find((s) => s.key === "engaged")?.reached ?? 0;
      const offFunnel = counts.offFunnel.map((b) => `${b.label}: ${b.count}`).join(" | ");

      response = `📊 **Pipeline Status** (reached = cumulative funnel, second number = parked there now)\n\n${funnelLines}\n\nOff funnel — ${offFunnel}\n\n${engaged === 0 && (counts.stages[2]?.reached ?? 0) > 0 ? "⚠️ Invited prospects exist but nobody has clicked yet. Consider follow-ups." : ""}\n${awaitingInvite > 0 ? `ℹ️ ${awaitingInvite} qualified prospect(s) are awaiting an invite (the invite cron sends these when outreach automation is live).` : "✅ No qualified prospects waiting on an invite."}${counts.hasAnomaly ? "\n\n🚨 A stage exceeds the previous stage's cumulative count — data drift, investigate." : ""}`;
    }

    // Email queries
    else if (message.includes("email") || message.includes("outreach") || message.includes("sent")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await db.collection("outreach_tasks").countDocuments({ status: "sent", createdAt: { $gte: today } });
      const failedToday = await db.collection("outreach_tasks").countDocuments({ status: "failed", createdAt: { $gte: today } });
      const pending = await db.collection("outreach_tasks").countDocuments({ status: "pending" });
      const totalSent = await db.collection("outreach_tasks").countDocuments({ status: "sent" });

      const recentFailures = await db.collection("outreach_tasks")
        .find({ status: "failed" })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

      response = `📧 **Email Status**\n\n• Sent Today: ${sentToday}\n• Failed Today: ${failedToday}\n• Pending Tasks: ${pending}\n• Total Sent (all time): ${totalSent}`;

      if (recentFailures.length > 0) {
        response += "\n\n**Recent Failures:**";
        recentFailures.forEach((f) => {
          response += `\n• ${f.leadName || "Unknown"} — ${f.error || "Unknown error"}`;
        });
      }

      if (sentToday === 0 && pending === 0) {
        response += "\n\n⚠️ No emails sent today and no pending tasks. The Auto Onboarding cron may not be creating outreach tasks. Check if it's running properly.";
      }
    }

    // Agent activity queries
    else if (message.includes("agent") || message.includes("idle") || message.includes("active")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const agentActivity = await db.collection("agent_activity").aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: "$agent.name", count: { $sum: 1 }, lastActivity: { $max: "$createdAt" } } },
        { $sort: { count: -1 } },
      ]).toArray();

      response = `🤖 **Agent Activity Today**\n\n`;

      if (agentActivity.length === 0) {
        response += "No agent activity recorded today. This is unusual — check if cron jobs are running.";
      } else {
        agentActivity.forEach((a) => {
          const name = a._id || "Unknown";
          const lastTime = a.lastActivity ? new Date(a.lastActivity).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "N/A";
          const status = a.count > 5 ? "🟢" : a.count > 0 ? "🟡" : "🔴";
          response += `${status} **${name}**: ${a.count} runs (last: ${lastTime})\n`;
        });
      }
    }

    // Prospects / leads queries
    else if (message.includes("prospect") || message.includes("lead") || message.includes("find")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newToday = await db.collection("outbound_prospects").countDocuments({ createdAt: { $gte: today } });
      const highScore = await db.collection("outbound_prospects").countDocuments({ aiScore: { $gte: 85 } });
      const sources = await db.collection("outbound_prospects").aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray();

      response = `🔍 **Prospects Overview**\n\n• New Today: ${newToday}\n• High Score (85+): ${highScore}\n\n**By Source:**\n`;
      sources.forEach((s) => {
        response += `• ${s._id}: ${s.count}\n`;
      });
    }

    // Cron job queries
    else if (message.includes("cron") || message.includes("job") || message.includes("schedule")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cronRuns = await db.collection("agent_activity").aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray();

      response = `⏰ **Cron Jobs Today**\n\n`;
      cronRuns.forEach((c) => {
        const emoji = c._id.includes("supervisor") ? "🛡️" : c._id.includes("outreach") ? "📧" : c._id.includes("onboarding") ? "📋" : c._id.includes("prospecting") ? "🔍" : "⚙️";
        response += `${emoji} **${c._id}**: ${c.count} runs\n`;
      });
    }

    // Cold call queue
    else if (message.includes("cold call") || message.includes("phone") || message.includes("no email")) {
      const coldCall = await db.collection("outbound_prospects").find({
        status: "qualified",
        "contact.email": { $exists: false },
        "contact.phone": { $exists: true },
      }).sort({ aiScore: -1 }).limit(10).toArray();

      response = `📞 **Cold Call Queue** (${coldCall.length} prospects)\n\n`;
      coldCall.forEach((p) => {
        response += `• **${p.name}** (score: ${p.aiScore || "?"}) — ${p.contact.phone}\n`;
      });

      if (coldCall.length === 0) {
        response += "No prospects in the cold call queue right now.";
      }
    }

    // Help / default
    else if (message.includes("help") || message.includes("what can you")) {
      // NOTE: do not claim cron-trigger/auto-fix powers here — this keyword
      // chat is read-only. Automated fixing of broken jobs is handled by the
      // Mission Control hub watchdog (Projects/hub), not this endpoint.
      response = `🤖 **AI Supervisor — What I Can Do**\n\nI have real-time access to your database. You can ask me:\n\n• **"Pipeline status"** — Full funnel overview\n• **"Why no emails?"** — Diagnose outreach issues\n• **"Show idle agents"** — See who's not working\n• **"Prospects today"** — New finds and sources\n• **"Cron jobs"** — Job run counts\n• **"Cold call queue"** — Prospects needing phone outreach\n\nBroken or stale jobs are detected and auto-fixed by the Mission Control watchdog.`;
    }

    // Fallback — try to answer from data
    else {
      // Try to find relevant data based on keywords
      const total = await db.collection("outbound_prospects").countDocuments();
      const qualified = await db.collection("outbound_prospects").countDocuments({ aiScore: { $gte: 75 } });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await db.collection("outreach_tasks").countDocuments({ status: "sent", createdAt: { $gte: today } });

      response = `I can help with that! Based on current data:\n\n• Total prospects: ${total}\n• Qualified: ${qualified}\n• Emails sent today: ${sentToday}\n\nCould you be more specific? Try asking about:\n• Pipeline status\n• Email issues\n• Agent activity\n• Prospect sources\n• Cron job health`;
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[supervisor-chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    );
  }
}
