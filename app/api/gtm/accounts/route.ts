import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listAccounts } from "@/lib/gtm";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });

  try {
    const accounts = await listAccounts(conn.accessToken, conn.refreshToken);
    return NextResponse.json({
      accounts: accounts.map((a) => ({ accountId: a.accountId, name: a.name })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch GTM accounts" }, { status: 500 });
  }
}
