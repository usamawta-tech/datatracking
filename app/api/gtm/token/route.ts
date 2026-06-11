import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/gtm";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 404 });

  const accessToken = await getValidAccessToken({
    userId: session.userId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken ?? null,
    expiresAt: conn.expiresAt ?? null,
  });

  return NextResponse.json({
    accessToken,
    selectedAccountId:   conn.selectedAccountId,
    selectedContainerId: conn.selectedContainerId,
    selectedWorkspaceId: conn.selectedWorkspaceId,
  });
}
