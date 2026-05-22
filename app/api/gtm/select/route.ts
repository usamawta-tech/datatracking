import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, containerId, workspaceId } = await req.json();
  if (!accountId || !containerId || !workspaceId) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  await prisma.gtmConnection.update({
    where: { userId: session.userId },
    data: { selectedAccountId: accountId, selectedContainerId: containerId, selectedWorkspaceId: workspaceId },
  });

  return NextResponse.json({ message: "Selection saved!" });
}
