import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard — AI Tracker" };

export default async function DashboardPage() {
  const session = await verifySession();

  const [gtmConn, mpConn, funnels, tags] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } }),
    prisma.funnel.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } }),
    prisma.generatedTag.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const stats = [
    { label: "GTM", value: gtmConn ? "Connected" : "Not connected", ok: !!gtmConn },
    { label: "Mixpanel", value: mpConn ? "Connected" : "Not connected", ok: !!mpConn },
    { label: "Funnels", value: String(funnels.length), ok: funnels.length > 0 },
    { label: "Auto Tags", value: String(tags.length), ok: tags.length > 0 },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your tracking setup</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <Badge variant={s.ok ? "success" : "warning"}>{s.value}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      {(!gtmConn || !mpConn) && (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Complete your setup to start automatic tracking</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            {!gtmConn && (
              <Link href="/gtm">
                <Button variant="secondary" size="sm">Connect GTM</Button>
              </Link>
            )}
            {!mpConn && (
              <Link href="/mixpanel">
                <Button variant="secondary" size="sm">Connect Mixpanel</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent funnels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Funnels</CardTitle>
              <CardDescription>Your tracked conversion funnels</CardDescription>
            </div>
            <Link href="/gtm">
              <Button size="sm">+ New funnel</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {funnels.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No funnels yet — connect GTM and create your first funnel.
            </p>
          ) : (
            <div className="space-y-2">
              {funnels.map((f: { id: string; name: string; websiteUrl: string; steps: string }) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-400">{f.websiteUrl}</div>
                  </div>
                  <Badge variant="info">
                    {(JSON.parse(f.steps) as unknown[]).length} steps
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent generated tags */}
      {tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent auto-generated tags</CardTitle>
            <CardDescription>Tags created automatically in GTM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tags.map((t: { id: string; name: string; status: string }) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="text-sm text-gray-800">{t.name}</div>
                  <Badge
                    variant={
                      t.status === "published" ? "success" : t.status === "failed" ? "danger" : "warning"
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
