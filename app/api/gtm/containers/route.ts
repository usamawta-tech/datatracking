import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listContainers, getTagManagerClient, getValidAccessToken } from "@/lib/gtm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken({ userId: session.userId, accessToken: conn.accessToken, refreshToken: conn.refreshToken ?? null, expiresAt: conn.expiresAt ?? null });
    const containers = await listContainers(accountId, accessToken, conn.refreshToken);
    return NextResponse.json({
      containers: containers.map((c: { containerId?: string | null; name?: string | null }) => ({ containerId: c.containerId, name: c.name })),
    });
  } catch (e) {
    console.error("[gtm/containers]", e);
    const msg = e instanceof Error ? e.message : "Failed to fetch containers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, name } = await req.json();
  if (!accountId || !name) return NextResponse.json({ error: "accountId and name required" }, { status: 400 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken({ userId: session.userId, accessToken: conn.accessToken, refreshToken: conn.refreshToken ?? null, expiresAt: conn.expiresAt ?? null });
    const tm = getTagManagerClient(accessToken, conn.refreshToken);
    const res = await tm.accounts.containers.create({
      parent: `accounts/${accountId}`,
      requestBody: { name, usageContext: ["web"] },
    });
    const c = res.data;
    return NextResponse.json({ container: { containerId: c.containerId, name: c.name } });
  } catch (e) {
    console.error("[gtm/containers POST]", e);
    const msg = e instanceof Error ? e.message : "Failed to create container";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
