import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, pageUrl, pageDesc, triggerPath, tags } = body;

  if (!name || !pageUrl || !triggerPath || !tags) {
    return NextResponse.json({ error: "name, pageUrl, triggerPath, and tags are required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: session.userId,
      name,
      pageUrl,
      pageDesc: pageDesc ?? null,
      triggerPath,
      tags: typeof tags === "string" ? tags : JSON.stringify(tags),
    },
  });

  return NextResponse.json({ campaign });
}
