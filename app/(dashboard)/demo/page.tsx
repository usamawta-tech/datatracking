import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Demo Site — AI Tracker" };

export default async function DemoLaunchPage() {
  const session = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { siteKey: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const demoUrl = `${appUrl}/demo/${user!.siteKey}`;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demo Site</h1>
        <p className="text-gray-500 text-sm mt-1">
          A test portfolio site with your tracking script pre-installed. Click around to fire events.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">Demo URL</div>
          <code className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-2 block break-all">
            {demoUrl}
          </code>
        </div>

        <div className="flex gap-3">
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Open Demo Site →
          </a>
          <Link
            href="/events"
            className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            View Live Events
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">What gets tracked when you use the demo site</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "👁️", event: "page_view",       desc: "On load" },
            { icon: "🖱️", event: "button_click",     desc: "Nav & CTA buttons" },
            { icon: "📋", event: "form_submit",      desc: "Contact form" },
            { icon: "📜", event: "scroll_depth",     desc: "25/50/75/100%" },
          ].map((e) => (
            <div key={e.event} className="bg-gray-50 rounded-lg p-3">
              <div className="text-lg mb-1">{e.icon}</div>
              <div className="text-xs font-mono font-semibold text-gray-700">{e.event}</div>
              <div className="text-xs text-gray-400 mt-0.5">{e.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
