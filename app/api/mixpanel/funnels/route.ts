import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getFunnelData } from "@/lib/mixpanel";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } });
  if (!conn?.projectToken || !conn?.serviceAccountUser || !conn?.serviceAccountSecret) {
    return NextResponse.json({ error: "Mixpanel not connected" }, { status: 400 });
  }

  try {
    const data = await getFunnelData(
      conn.projectId || conn.projectToken,
      conn.serviceAccountUser,
      conn.serviceAccountSecret
    );
    return NextResponse.json({ funnels: Array.isArray(data) ? data : [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch Mixpanel funnels" }, { status: 500 });
  }
}
