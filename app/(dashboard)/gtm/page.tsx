import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { SetupWizard } from "@/components/gtm/setup-wizard";

export const metadata = { title: "GTM — AI Tracker" };

export default async function GtmPage() {
  const session = await verifySession();

  const [gtmConn, campaigns] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.campaign.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SetupWizard
      connected={!!gtmConn}
      accountId={gtmConn?.selectedAccountId ?? null}
      containerId={gtmConn?.selectedContainerId ?? null}
      workspaceId={gtmConn?.selectedWorkspaceId ?? null}
      campaigns={campaigns.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
