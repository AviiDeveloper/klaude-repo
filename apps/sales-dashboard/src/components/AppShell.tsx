'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutList, Map, User, Zap, LogOut, Wallet, Users, Settings, HelpCircle } from 'lucide-react';

const NAV_MAIN = [
  { href: '/dashboard', label: 'Leads', icon: LayoutList },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/payouts', label: 'Payouts', icon: Wallet },
  { href: '/referrals', label: 'Referrals', icon: Users },
];

const NAV_BOTTOM = [
  { href: '/help', label: 'Help', icon: HelpCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/profile', label: 'Account', icon: User },
];

// Mobile bottom nav only shows core pages
const NAV_MOBILE = [
  { href: '/dashboard', label: 'Leads', icon: LayoutList },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/payouts', label: 'Payouts', icon: Wallet },
  { href: '/profile', label: 'Account', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-slate-950 min-h-screen flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white leading-none">SalesFlow</div>
              <div className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.15em] mt-0.5">Sales</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2">
          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.1em] px-2 mb-2">Navigate</div>
          <div className="space-y-0.5">
            {NAV_MAIN.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all ${active ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : ''}`} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom nav */}
        <div className="px-3 py-3 border-t border-white/5 space-y-0.5">
          {NAV_BOTTOM.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all ${active ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'}`}>
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : ''}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 border-l border-slate-100 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom nav — only shows on small screens */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-slate-200 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-12">
          {NAV_MOBILE.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 ${
                  active ? 'text-primary' : 'text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
