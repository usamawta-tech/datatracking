import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { validateMixpanelCredentials } from "@/lib/mixpanel";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectToken, serviceAccountUser, serviceAccountSecret, projectId } = await req.json();

  if (!projectToken || !serviceAccountUser || !serviceAccountSecret) {
    return NextResponse.json({ error: "Project token, service account user and secret are required" }, { status: 400 });
  }

  const valid = await validateMixpanelCredentials(projectToken, serviceAccountUser, serviceAccountSecret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid Mixpanel credentials. Please check your token and service account." }, { status: 400 });
  }

  await prisma.mixpanelConnection.upsert({
    where: { userId: session.userId },
    update: { projectToken, serviceAccountUser, serviceAccountSecret, projectId: projectId || null },
    create: { userId: session.userId, projectToken, serviceAccountUser, serviceAccountSecret, projectId: projectId || null },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.mixpanelConnection.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ success: true });
}
