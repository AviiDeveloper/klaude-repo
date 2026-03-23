'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutList, Map, User } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Leads', icon: LayoutList },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/profile', label: 'Account', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-border pb-safe-bottom">
      <div className="flex items-center justify-around h-12 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-4 py-1',
                active ? 'text-primary' : 'text-faint',
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-2xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
