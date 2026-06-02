import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { activateMixpanelTracking, getValidAccessToken } from "@/lib/gtm";

export async function POST() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gtmConn, mpConn] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } }),
  ]);

  if (!gtmConn?.selectedAccountId || !gtmConn?.selectedContainerId || !gtmConn?.selectedWorkspaceId) {
    return NextResponse.json({ error: "Select a GTM account, container and workspace first" }, { status: 400 });
  }
  if (!mpConn?.projectToken) {
    return NextResponse.json({ error: "Connect Mixpanel first" }, { status: 400 });
  }

  // Check if already activated
  const existing = await prisma.generatedTag.findFirst({
    where: { userId: session.userId, name: "MP - Init" },
  });
  if (existing) {
    return NextResponse.json({ error: "Mixpanel tracking is already activated in this workspace" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken({
      userId: session.userId,
      accessToken: gtmConn.accessToken,
      refreshToken: gtmConn.refreshToken ?? null,
      expiresAt: gtmConn.expiresAt ?? null,
    });

    const { tagsCreated } = await activateMixpanelTracking(
      gtmConn.selectedAccountId,
      gtmConn.selectedContainerId,
      gtmConn.selectedWorkspaceId,
      mpConn.projectToken,
      accessToken,
      gtmConn.refreshToken ?? null
    );

    // Save all created tags to DB
    await Promise.all(
      tagsCreated.map((name) =>
        prisma.generatedTag.create({
          data: {
            userId: session.userId,
            name,
            tagType: "auto_event",
            triggerName: name.replace("MP - ", ""),
            config: JSON.stringify({ activatedAt: new Date().toISOString() }),
            status: "published",
          },
        })
      )
    );

    return NextResponse.json({ success: true, tagsCreated });
  } catch (e) {
    console.error("[gtm/activate]", e);
    const msg = e instanceof Error ? e.message : "Activation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
