'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

const NO_SHELL_ROUTES = ['/login', '/signup'];

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideShell = NO_SHELL_ROUTES.some((r) => pathname.startsWith(r));

  if (hideShell) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
