import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listContainers } from "@/lib/gtm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const containers = await listContainers(accountId, conn.accessToken, conn.refreshToken);
    return NextResponse.json({
      containers: containers.map((c) => ({ containerId: c.containerId, name: c.name })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch containers" }, { status: 500 });
  }
}
