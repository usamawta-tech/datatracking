import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard — AI Tracker" };

export default async function DashboardPage() {
  const session = await verifySession();

  const [gtmConn, mpConn, funnels, tags, eventCount, recentEvents] = await Promise.all([
    prisma.gtmConnection.findUnique({ where: { userId: session.userId } }),
    prisma.mixpanelConnection.findUnique({ where: { userId: session.userId } }),
    prisma.funnel.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } }),
    prisma.generatedTag.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.event.count({ where: { userId: session.userId } }),
    prisma.event.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, path: true, createdAt: true },
    }),
  ]);

  const scriptInstalled = eventCount > 0;
  const autoTagCount = tags.filter((t) => t.tagType === "auto_event").length;
  const funnelTagCount = tags.filter((t) => t.tagType !== "auto_event").length;
  const publishedCount = tags.filter((t) => t.status === "published").length;

  const setupSteps = [
    { done: !!gtmConn, label: "Connect GTM",           href: "/gtm",      icon: "🏷️" },
    { done: !!mpConn,  label: "Connect Mixpanel",      href: "/mixpanel", icon: "📈" },
    { done: scriptInstalled, label: "Install Script",  href: "/install",  icon: "⚡" },
  ];
  const allSetup = setupSteps.every((s) => s.done);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Tracking engine status</p>
      </div>

      {/* Setup checklist */}
      {!allSetup && (
        <Card className="border-blue-100 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-900">Setup checklist</CardTitle>
            <CardDescription className="text-blue-700">
              Complete these steps to activate automatic tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupSteps.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${s.done ? "opacity-100" : "opacity-40"}`}>{s.done ? "✅" : "⬜"}</span>
                  <span className={`text-sm font-medium ${s.done ? "text-gray-500 line-through" : "text-gray-800"}`}>
                    {s.label}
                  </span>
                </div>
                {!s.done && (
                  <Link href={s.href}>
                    <Button size="sm" variant="secondary">Set up →</Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="GTM"            value={gtmConn ? "Connected" : "Not connected"} ok={!!gtmConn}         href="/gtm" />
        <StatCard label="Mixpanel"       value={mpConn  ? "Connected" : "Not connected"} ok={!!mpConn}          href="/mixpanel" />
        <StatCard label="Script"         value={scriptInstalled ? `${eventCount} events` : "Not installed"}     ok={scriptInstalled} href="/install" />
        <StatCard label="Auto Tags"      value={`${publishedCount} published`}            ok={publishedCount > 0} href="/gtm" />
      </div>

      {/* Tracking flow */}
      <Card>
        <CardHeader>
          <CardTitle>Tracking flow</CardTitle>
          <CardDescription>How events flow from your website to Mixpanel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {[
              { label: "Your Website",   ok: scriptInstalled },
              { label: "tracker.js",     ok: scriptInstalled },
              { label: "dataLayer",      ok: scriptInstalled },
              { label: "Backend API",    ok: scriptInstalled },
              { label: "GTM",            ok: !!gtmConn && publishedCount > 0 },
              { label: "Mixpanel",       ok: !!mpConn },
            ].map((node, i, arr) => (
              <div key={node.label} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg font-medium text-xs border ${
                  node.ok
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}>
                  {node.label}
                </span>
                {i < arr.length - 1 && (
                  <span className={`text-lg ${node.ok ? "text-green-400" : "text-gray-200"}`}>→</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Events</CardTitle>
                <CardDescription>Latest activity from your website</CardDescription>
              </div>
              <Link href="/events">
                <Button size="sm" variant="secondary">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">📡</div>
                <p className="text-sm text-gray-400">No events yet</p>
                <Link href="/install" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Install tracking script →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{typeIcon(e.type)}</span>
                      <span className="text-xs font-mono text-gray-600 truncate">{e.path}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-generated tags */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Auto Tags</CardTitle>
                <CardDescription>GTM tags created automatically</CardDescription>
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>{autoTagCount} event</span>
                <span>·</span>
                <span>{funnelTagCount} funnel</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🏷️</div>
                <p className="text-sm text-gray-400">No tags yet</p>
                <p className="text-xs text-gray-400 mt-1">Tags are created automatically when events are detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-400">{t.tagType === "auto_event" ? "⚡" : "🔀"}</span>
                      <span className="text-sm text-gray-800 truncate">{t.name}</span>
                    </div>
                    <Badge variant={t.status === "published" ? "success" : t.status === "failed" ? "danger" : "warning"}>
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnels */}
      {funnels.length > 0 && (
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
            <div className="space-y-2">
              {funnels.map((f) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, ok, href }: { label: string; value: string; ok: boolean; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:border-blue-200 transition-colors cursor-pointer">
        <CardContent className="pt-4">
          <div className="text-xs text-gray-500 mb-1">{label}</div>
          <Badge variant={ok ? "success" : "warning"}>{value}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

function typeIcon(type: string) {
  const icons: Record<string, string> = {
    page_view: "👁️", button_click: "🖱️", form_submit: "📋",
    signup: "✍️", login: "🔑", checkout_started: "🛒", purchase: "💳", scroll_depth: "📜",
  };
  return icons[type] || "•";
}
