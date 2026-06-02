import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/mixpanel";

export async function POST() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } });
  if (!conn?.projectToken) return NextResponse.json({ error: "Mixpanel not connected" }, { status: 400 });

  const ok = await trackEvent(conn.projectToken, "AI Tracker Test Event", {
    source: "ai-tracker",
    timestamp: new Date().toISOString(),
    distinct_id: session.userId,
  });

  return NextResponse.json({ success: ok });
}
