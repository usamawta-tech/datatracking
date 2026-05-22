import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { GtmPageClient } from "@/components/gtm/gtm-page-client";

export const metadata = { title: "GTM — AI Tracker" };

export default async function GtmPage() {
  const session = await verifySession();

  const [gtmConn, mpConn, funnels] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } }),
    prisma.funnel.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { generatedTags: true },
    }),
  ]);

  const funnelsWithParsed = funnels.map((f: typeof funnels[number]) => ({
    ...f,
    steps: JSON.parse(f.steps) as Array<{ name: string; url: string; eventName: string }>,
  }));

  return (
    <GtmPageClient
      connected={!!gtmConn}
      accountId={gtmConn?.selectedAccountId ?? null}
      containerId={gtmConn?.selectedContainerId ?? null}
      workspaceId={gtmConn?.selectedWorkspaceId ?? null}
      funnels={funnelsWithParsed}
      mixpanelToken={mpConn?.projectToken ?? null}
    />
  );
}
