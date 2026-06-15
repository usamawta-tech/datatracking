import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listAccounts, getValidAccessToken } from "@/lib/gtm";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken({
      userId: session.userId,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken ?? null,
      expiresAt: conn.expiresAt ?? null,
    });
    const accounts = await listAccounts(accessToken);
    if (!accounts.length) {
      return NextResponse.json({ error: "No GTM accounts found. Make sure the Google account you connected has access to Google Tag Manager." }, { status: 404 });
    }
    return NextResponse.json({
      accounts: accounts.map((a: { accountId?: string | null; name?: string | null }) => ({ accountId: a.accountId, name: a.name })),
    });
  } catch (e) {
    console.error("[gtm/accounts]", e);
    const msg = e instanceof Error ? e.message : "Failed to fetch GTM accounts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
