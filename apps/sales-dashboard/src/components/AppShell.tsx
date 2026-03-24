'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';

const NAV_LINKS = [
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
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* ── Top navigation bar ── */}
      <nav className="sticky top-0 z-50 bg-[rgba(251,251,253,0.8)] backdrop-blur-xl backdrop-saturate-[180%] border-b border-[#d2d2d7]/60">
        <div className="max-w-[980px] mx-auto px-6 h-11 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="text-[#1d1d1f] flex items-center gap-1.5 shrink-0">
            <span className="text-[16px]">⚡</span>
            <span className="text-[12px] font-semibold tracking-[-0.01em]">SalesFlow</span>
          </Link>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-[12px] tracking-[-0.01em] transition-colors ${
                    active
                      ? 'text-[#1d1d1f] font-medium'
                      : 'text-[#424245] hover:text-[#1d1d1f]'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Account */}
          <Link href="/profile" className="text-[#424245] hover:text-[#1d1d1f] transition-colors">
            <User className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </Link>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-[980px] mx-auto px-6">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[rgba(251,251,253,0.8)] backdrop-blur-xl backdrop-saturate-[180%] border-t border-[#d2d2d7]/60 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-[50px]">
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
                className={`text-[10px] tracking-[0.01em] py-1 ${
                  active ? 'text-[#0071e3] font-medium' : 'text-[#86868b]'
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
