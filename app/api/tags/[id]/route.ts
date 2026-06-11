import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const tag = await prisma.generatedTag.findFirst({ where: { id, userId: session.userId } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.generatedTag.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const tag = await prisma.generatedTag.findFirst({ where: { id, userId: session.userId } });
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.generatedTag.update({ where: { id }, data: { name: name.trim() } });

  return NextResponse.json({ tag: updated });
}
