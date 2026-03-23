'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Users, MapPin, Cpu, LogOut, Zap } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: Activity },
  { href: '/pipeline', label: 'Pipeline', icon: Cpu },
  { href: '/salesforce', label: 'Salesforce', icon: Users },
  { href: '/leads', label: 'Leads', icon: MapPin },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="w-52 bg-white border-r border-surface-border min-h-screen flex flex-col">
      <div className="px-4 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-primary leading-none">SalesFlow</div>
            <div className="text-[9px] text-muted font-medium uppercase tracking-widest mt-0.5">Ops</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                active ? 'bg-slate-100 text-primary' : 'text-muted hover:text-primary hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-surface-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium text-muted hover:text-danger hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
