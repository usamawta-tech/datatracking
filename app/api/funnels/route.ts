import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";

const FunnelSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  steps: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().min(1),
      eventName: z.string().min(1),
    })
  ).min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const funnels = await prisma.funnel.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { generatedTags: true },
  });

  return NextResponse.json({ funnels: funnels.map((f: typeof funnels[number]) => ({ ...f, steps: JSON.parse(f.steps) as unknown[] })) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = FunnelSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { name, websiteUrl, steps } = result.data;
  const funnel = await prisma.funnel.create({
    data: {
      userId: session.userId,
      name,
      websiteUrl,
      steps: JSON.stringify(steps),
    },
  });

  return NextResponse.json({ funnel: { ...funnel, steps } });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.funnel.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ success: true });
}
