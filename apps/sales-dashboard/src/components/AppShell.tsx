'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Leads' },
  { href: '/map', label: 'Map' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/referrals', label: 'Referrals' },
  { href: '/help', label: 'Help' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-[#ededed]">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-[#333] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#555] after:to-transparent after:opacity-40">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold text-[14px] tracking-[-0.02em]">
            <svg width="18" height="18" viewBox="0 0 76 65" fill="white"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
            SalesFlow
          </Link>

          {/* Links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                    active
                      ? 'text-white bg-[#1a1a1a]'
                      : 'text-[#888] hover:text-[#ededed]'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Avatar */}
          <Link href="/profile" className="w-7 h-7 rounded-full bg-gradient-to-br from-[#333] to-[#555] flex items-center justify-center text-[11px] font-medium text-white">
            D
          </Link>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="max-w-[1200px] mx-auto px-6">
        {children}
      </main>

      {/* ── Mobile nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-black/90 backdrop-blur-xl border-t border-[#333] md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-12">
          {[
            { href: '/dashboard', label: 'Leads' },
            { href: '/map', label: 'Map' },
            { href: '/payouts', label: 'Payouts' },
            { href: '/profile', label: 'Account' },
          ].map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`text-[11px] py-1 transition-colors ${
                  active ? 'text-white' : 'text-[#666]'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
