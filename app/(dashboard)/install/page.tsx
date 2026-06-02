import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { InstallPageClient } from "@/components/install/install-page-client";

export const metadata = { title: "Install Script — AI Tracker" };

export default async function InstallPage() {
  const session = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { siteKey: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const eventCount = await prisma.event.count({ where: { userId: session.userId } });

  return (
    <InstallPageClient
      siteKey={user!.siteKey}
      appUrl={appUrl}
      initialEventCount={eventCount}
    />
  );
}
