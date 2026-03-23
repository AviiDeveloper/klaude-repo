'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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

      // Full page redirect so the browser picks up the Set-Cookie header
      window.location.href = '/dashboard';
    } catch {
      setError('Network error — check your connection');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-sd-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">&#x26A1;</span>
          </div>
          <h1 className="text-2xl font-bold text-sd-text">SalesFlow</h1>
          <p className="text-sd-text-muted text-sm mt-1">Walk in. Pitch. Sell.</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Name */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sd-text-muted" />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-sd-bg-card border border-sd-border rounded-xl py-3.5 pl-12 pr-4 text-sd-text placeholder:text-sd-text-muted/50 focus:outline-none focus:border-sd-accent focus:ring-1 focus:ring-sd-accent transition-colors"
              autoComplete="username"
              autoCapitalize="words"
            />
          </div>

          {/* PIN */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sd-text-muted" />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full bg-sd-bg-card border border-sd-border rounded-xl py-3.5 pl-12 pr-4 text-sd-text placeholder:text-sd-text-muted/50 focus:outline-none focus:border-sd-accent focus:ring-1 focus:ring-sd-accent transition-colors tracking-[0.3em] text-center text-lg"
              autoComplete="current-password"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-sd-red/10 border border-sd-red/20 rounded-xl px-4 py-3 text-sd-red text-sm text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || name.trim().length === 0 || pin.trim().length === 0}
            className="w-full bg-sd-accent hover:bg-sd-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sd-text-muted/40 text-xs mt-8">
          Contact your manager if you need access
        </p>
      </div>
    </div>
  );
}
