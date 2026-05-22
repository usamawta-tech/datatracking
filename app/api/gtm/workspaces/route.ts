import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listWorkspaces } from "@/lib/gtm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  const containerId = req.nextUrl.searchParams.get("containerId");
  if (!accountId || !containerId) {
    return NextResponse.json({ error: "accountId and containerId required" }, { status: 400 });
  }

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const workspaces = await listWorkspaces(accountId, containerId, conn.accessToken, conn.refreshToken);
    return NextResponse.json({
      workspaces: workspaces.map((w) => ({ workspaceId: w.workspaceId, name: w.name })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}
