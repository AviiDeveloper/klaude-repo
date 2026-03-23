'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Connection error');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-primary tracking-tight">SalesFlow</h1>
          <p className="text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg py-2.5 px-3 text-sm text-primary bg-white placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-colors"
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-border rounded-lg py-2.5 px-3 text-sm text-primary bg-white placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-colors tracking-widest"
              placeholder="Enter PIN"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-status-rejected text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || name.trim().length === 0 || pin.trim().length === 0}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-opacity"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <p className="text-faint text-xs mt-8 text-center">
          New here? <a href="/signup" className="text-primary font-medium hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  );
}
