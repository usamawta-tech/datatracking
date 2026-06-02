import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getValidAccessToken, deployCampaignTags, PlatformTagConfig } from "@/lib/gtm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: session.userId },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });
  if (!conn.selectedAccountId || !conn.selectedContainerId || !conn.selectedWorkspaceId) {
    return NextResponse.json({ error: "GTM account, container, and workspace must be selected" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken({
      userId: session.userId,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken ?? null,
      expiresAt: conn.expiresAt ?? null,
    });

    let platformTags: PlatformTagConfig[];
    try {
      const parsed = typeof campaign.tags === "string" ? JSON.parse(campaign.tags) : campaign.tags;
      platformTags = Array.isArray(parsed) ? parsed : [];
    } catch {
      return NextResponse.json({ error: "Invalid tags data" }, { status: 400 });
    }

    const result = await deployCampaignTags(
      conn.selectedAccountId,
      conn.selectedContainerId,
      conn.selectedWorkspaceId,
      campaign.name,
      campaign.triggerPath,
      platformTags,
      accessToken,
      conn.refreshToken
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "deployed",
        gtmTagData: JSON.stringify(result),
      },
    });

    return NextResponse.json({ success: true, tags: result.tags });
  } catch (e) {
    console.error("[campaigns/deploy]", e);
    const msg = e instanceof Error ? e.message : "Deployment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
