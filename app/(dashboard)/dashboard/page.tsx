import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { TagsCard } from "@/components/dashboard/tags-card";

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
    }),
  ]);

  const publishedCount = tags.filter((t) => t.status === "published").length;

  const setupSteps = [
    { done: !!gtmConn, label: "Connect GTM",      href: "/gtm",      desc: "Link your Google Tag Manager account" },
    { done: !!mpConn,  label: "Connect Mixpanel", href: "/mixpanel", desc: "Add your Mixpanel project token" },
  ];
  const setupDone = setupSteps.every((s) => s.done);

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Overview of your tracking setup</p>
      </div>

      {/* Setup checklist */}
      {!setupDone && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">Complete your setup</p>
              <p className="text-xs text-indigo-600 mt-0.5">{setupSteps.filter(s => s.done).length} of {setupSteps.length} steps done</p>
            </div>
          </div>
          <div className="space-y-3">
            {setupSteps.map((s) => (
              <div key={s.label} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-green-500" : "bg-gray-100 border border-gray-200"}`}>
                    {s.done ? (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : null}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${s.done ? "text-gray-400 line-through" : "text-gray-800"}`}>{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                </div>
                {!s.done && (
                  <Link
                    href={s.href}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Set up →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          href="/gtm"
          label="GTM"
          value={gtmConn ? "Connected" : "Not connected"}
          ok={!!gtmConn}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
        />
        <StatCard
          href="/mixpanel"
          label="Mixpanel"
          value={mpConn ? "Connected" : "Not connected"}
          ok={!!mpConn}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          href="/gtm"
          label="Published Tags"
          value={publishedCount === 0 ? "None yet" : `${publishedCount} live`}
          ok={publishedCount > 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
      </div>

      {/* Tags table */}
      <TagsCard
        initialTags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          tagType: t.tagType,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
        }))}
      />

      {/* Funnels */}
      {funnels.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Funnels</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your tracked conversion funnels</p>
            </div>
            <Link
              href="/gtm"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              + New funnel
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {funnels.map((f) => {
              let stepCount = 0;
              try { stepCount = (JSON.parse(f.steps) as unknown[]).length; } catch { /* noop */ }
              return (
                <div key={f.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.websiteUrl}</p>
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                    {stepCount} steps
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function StatCard({ href, label, value, ok, icon }: {
  href: string; label: string; value: string; ok: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all group">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ok ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
            {icon}
          </div>
          <div className={`w-2 h-2 rounded-full mt-1 ${ok ? "bg-green-400" : "bg-gray-300"}`} />
        </div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-sm font-semibold ${ok ? "text-gray-900" : "text-gray-500"}`}>{value}</p>
      </div>
    </Link>
  );
}

