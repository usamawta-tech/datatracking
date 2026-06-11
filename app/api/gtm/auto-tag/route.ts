import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createFunnelTagsInGTM, getValidAccessToken, type FunnelStep } from "@/lib/gtm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { funnelId } = await req.json();
  if (!funnelId) return NextResponse.json({ error: "funnelId required" }, { status: 400 });

  const [funnel, gtmConn, mpConn] = await Promise.all([
    prisma.funnel.findFirst({ where: { id: funnelId, userId: session.userId } }),
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } }),
  ]);

  if (!funnel) return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  if (!gtmConn?.selectedAccountId || !gtmConn?.selectedContainerId || !gtmConn?.selectedWorkspaceId) {
    return NextResponse.json({ error: "GTM account/container/workspace not selected" }, { status: 400 });
  }
  if (!mpConn?.projectToken) {
    return NextResponse.json({ error: "Mixpanel not connected" }, { status: 400 });
  }

  try {
    // Get a fresh (non-expired) access token, refreshing if needed
    const accessToken = await getValidAccessToken({
      userId: session.userId,
      accessToken: gtmConn.accessToken,
      refreshToken: gtmConn.refreshToken ?? null,
      expiresAt: gtmConn.expiresAt ?? null,
    });

    const steps: FunnelStep[] = JSON.parse(funnel.steps);

    const createdTags = await createFunnelTagsInGTM(
      gtmConn.selectedAccountId,
      gtmConn.selectedContainerId,
      gtmConn.selectedWorkspaceId,
      funnel.name,
      steps,
      mpConn.projectToken,
      accessToken,
      gtmConn.refreshToken
    );

    const savedTags = await Promise.all(
      createdTags.map((t) =>
        prisma.generatedTag.create({
          data: {
            userId: session.userId,
            funnelId: funnel.id,
            gtmTagId: t.tagId ?? undefined,
            name: t.name ?? `Tag - ${t.step}`,
            tagType: t.tagType ?? "mixpanel",
            triggerName: `Trigger - ${funnel.name} - ${t.step}`,
            config: JSON.stringify(t),
            status: "published",
          },
        })
      )
    );

    return NextResponse.json({ tags: savedTags });
  } catch (e: unknown) {
    console.error("Auto-tag error:", e);
    const apiMsg = (() => {
      if (e && typeof e === "object") {
        const data = ((e as Record<string,unknown>).response as Record<string,unknown> | undefined)?.data as Record<string,unknown> | undefined;
        const nested = data?.error as Record<string,unknown> | undefined;
        if (typeof nested?.message === "string") return nested.message;
      }
      return e instanceof Error ? e.message : "Auto-tagging failed";
    })();
    const status = /workspace|submitted|GTM/i.test(apiMsg) ? 422 : 500;
    return NextResponse.json({ error: apiMsg }, { status });
  }
}
