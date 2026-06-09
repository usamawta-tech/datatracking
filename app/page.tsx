import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">AI Tracker</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full px-4 py-1.5 text-xs font-semibold mb-10 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          Automated GTM &amp; Mixpanel Tracking
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
          Deploy tracking tags
          <br />
          <span className="text-indigo-600">without the manual work</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Define your conversion funnel, connect GTM and Mixpanel, and let AI automatically
          create every tag, trigger, and event — in minutes, not days.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/25 text-sm"
          >
            Start for free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-7 py-3 rounded-xl border border-gray-200 hover:border-gray-300 bg-white transition-colors text-sm"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              color: "indigo",
              bg: "bg-indigo-50",
              border: "border-indigo-100",
              iconBg: "bg-indigo-600",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
              ),
              title: "Auto GTM Tags",
              desc: "Define your funnel pages and AI creates GTM tags, triggers, and variables — deployed and published automatically.",
            },
            {
              color: "violet",
              bg: "bg-violet-50",
              border: "border-violet-100",
              iconBg: "bg-violet-600",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ),
              title: "Mixpanel Events",
              desc: "Events fire in Mixpanel automatically when users hit each step of your funnel. No manual code required.",
            },
            {
              color: "sky",
              bg: "bg-sky-50",
              border: "border-sky-100",
              iconBg: "bg-sky-600",
              icon: (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: "Funnel Analytics",
              desc: "Visualize drop-offs and conversion rates. See exactly where users leave your funnel in real time.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`${f.bg} border ${f.border} rounded-2xl p-6`}
            >
              <div className={`w-10 h-10 ${f.iconBg} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-base">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-900 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Up and running in minutes</h2>
          <p className="text-slate-400 text-sm mb-12">No tagging knowledge required.</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {[
              { step: "1", label: "Connect GTM", desc: "Authorize your Google Tag Manager account." },
              { step: "2", label: "Build your funnel", desc: "Add pages and define which tags fire on each." },
              { step: "3", label: "Review", desc: "Confirm every tag before publishing to GTM." },
              { step: "4", label: "Deploy", desc: "One click creates and publishes all tags live." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold text-sm flex items-center justify-center mb-3">
                  {s.step}
                </div>
                <p className="text-white font-semibold text-sm mb-1">{s.label}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500">AI Tracker</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} WeTrackAds</p>
        </div>
      </footer>
    </main>
  );
}
