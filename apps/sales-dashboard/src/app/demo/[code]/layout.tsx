// Demo pages have their own layout — no sidebar, no nav, no auth
// This completely bypasses the ConditionalShell/AppShell
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
