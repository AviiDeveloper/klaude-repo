'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

// Routes that should NOT show the sidebar/shell (public pages, auth pages)
const NO_SHELL_ROUTES = ['/login', '/signup', '/demo', '/legal'];

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideShell = NO_SHELL_ROUTES.some((r) => pathname.startsWith(r));

  if (hideShell) {
    return <div>{children}</div>;
  }

  return <AppShell>{children}</AppShell>;
}
