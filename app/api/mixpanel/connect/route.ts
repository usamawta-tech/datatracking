import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as Partial<{
      projectToken: string;
      serviceAccountUser: string;
      serviceAccountSecret: string;
      projectId: string;
    }>;

    const projectToken = process.env.MIXPANEL_PROJECT_TOKEN || body.projectToken;
    if (!projectToken) {
      return NextResponse.json({ error: "Project Token is required" }, { status: 400 });
    }

    // Service account fields are optional — only needed for reading funnel data
    const serviceAccountUser =
      process.env.MIXPANEL_SERVICE_ACCOUNT_USER ||
      process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME ||
      body.serviceAccountUser ||
      null;

    const serviceAccountSecret =
      process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET ||
      body.serviceAccountSecret ||
      null;

    const projectId =
      process.env.MIXPANEL_PROJECT_ID || body.projectId || null;

    await prisma.mixpanelConnection.upsert({
      where: { userId: session.userId },
      update: { projectToken, serviceAccountUser, serviceAccountSecret, projectId },
      create: { userId: session.userId, projectToken, serviceAccountUser, serviceAccountSecret, projectId },
    });

    return NextResponse.json({ success: true, connected: true });
  } catch (error) {
    console.error("Mixpanel connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Mixpanel" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.mixpanelConnection.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ success: true });
}
