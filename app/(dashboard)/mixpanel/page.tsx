import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { MixpanelPageClient } from "@/components/mixpanel/mixpanel-page-client";

export const metadata = { title: "Mixpanel — AI Tracker" };

export default async function MixpanelPage() {
  const session = await verifySession();
  const conn = await prisma.mixpanelConnection.findUnique({
    where: { userId: session.userId },
  });

  return (
    <MixpanelPageClient
      connected={!!conn}
      projectToken={conn?.projectToken ?? null}
      serviceAccountUser={conn?.serviceAccountUser ?? null}
      projectId={conn?.projectId ?? null}
    />
  );
}
