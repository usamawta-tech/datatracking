import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.gtmConnection.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ success: true });
}
