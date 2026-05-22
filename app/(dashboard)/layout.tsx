import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/gtm", label: "GTM", icon: "🏷️" },
  { href: "/mixpanel", label: "Mixpanel", icon: "📈" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">AI Tracker</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium"
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="text-xs text-gray-400 mb-2 truncate">{user?.email}</div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
