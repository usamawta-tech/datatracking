import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { EventFeed } from "@/components/events/event-feed";

export const metadata = { title: "Live Events — AI Tracker" };

export default async function EventsPage() {
  const session = await verifySession();

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, url: true, path: true, title: true, element: true, referrer: true, createdAt: true },
    }),
    prisma.event.count({ where: { userId: session.userId } }),
  ]);

  return (
    <EventFeed
      initialEvents={events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
      initialTotal={total}
    />
  );
}
