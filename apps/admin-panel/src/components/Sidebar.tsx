'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, MapPin, Settings, LogOut, Shield } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/leads', label: 'Leads', icon: MapPin },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 bg-white border-r border-surface-border min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-primary">SalesFlow</div>
            <div className="text-[10px] text-muted font-medium uppercase tracking-wider">Admin</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-primary hover:bg-surface-alt'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-surface-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-danger hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
