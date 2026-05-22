import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">AI Tracker</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="secondary" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse inline-block" />
          Automatic GTM tagging &amp; Mixpanel tracking
        </div>

        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Track your website funnels{" "}
          <span className="text-blue-600">automatically</span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Connect Google Tag Manager and Mixpanel, define your funnel steps, and let AI create
          all the tags and triggers automatically — no manual tagging required.
        </p>

        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">Start for free</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: "🏷️",
            title: "Auto GTM Tags",
            desc: "Define your funnel URLs and AI creates GTM tags, triggers, and variables automatically.",
          },
          {
            icon: "📊",
            title: "Mixpanel Events",
            desc: "Events fire in Mixpanel automatically when users hit each step of your funnel.",
          },
          {
            icon: "🔍",
            title: "Funnel Analytics",
            desc: "Visualize drop-offs and conversion rates across all your tracked funnels.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
