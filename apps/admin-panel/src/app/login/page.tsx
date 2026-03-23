'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/dashboard');
    } catch { setError('Network error'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-white mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-primary">SalesFlow Admin</h1>
          <p className="text-sm text-muted mt-1">Team management portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-border p-6 shadow-sm">
          {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-danger text-sm">{error}</div>}

          <div className="mb-4">
            <label className="block text-xs font-medium text-muted mb-1.5">Username or Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-surface-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              autoFocus
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-surface-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
