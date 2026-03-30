import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">OpenClaw Local Agent MVP</h1>
        <p className="text-neutral-400 mb-8">
          Select an application to view:
        </p>
        <div className="grid gap-4">
          <div className="p-6 bg-neutral-900 rounded-lg border border-neutral-800">
            <h2 className="text-xl font-semibold mb-2">Mission Control</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Main control interface for the multi-agent system
            </p>
            <code className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
              npm run mc:dev
            </code>
          </div>
          <div className="p-6 bg-neutral-900 rounded-lg border border-neutral-800">
            <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Administrative dashboard
            </p>
            <code className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
              apps/admin-panel
            </code>
          </div>
          <div className="p-6 bg-neutral-900 rounded-lg border border-neutral-800">
            <h2 className="text-xl font-semibold mb-2">Sales Dashboard</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Sales analytics and tracking
            </p>
            <code className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
              apps/sales-dashboard
            </code>
          </div>
        </div>
      </div>
    </main>
  );
}
