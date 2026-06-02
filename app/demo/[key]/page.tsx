import { prisma } from "@/lib/db";
import { DemoSite } from "@/components/demo/demo-site";
import { notFound } from "next/navigation";

export const metadata = { title: "John Carter — Portfolio" };

export default async function DemoPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const user = await prisma.user.findUnique({
    where: { siteKey: key },
    select: { id: true },
  });

  if (!user) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return <DemoSite siteKey={key} appUrl={appUrl} />;
}
