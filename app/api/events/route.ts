import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const after = searchParams.get("after"); // cursor: createdAt ISO string

  const events = await prisma.event.findMany({
    where: {
      userId: session.userId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      url: true,
      path: true,
      title: true,
      element: true,
      referrer: true,
      createdAt: true,
    },
  });

  const total = await prisma.event.count({ where: { userId: session.userId } });

  return NextResponse.json({ events, total });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.event.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ ok: true });
}
