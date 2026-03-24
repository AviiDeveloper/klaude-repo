'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 page-enter">
      <div className="w-full max-w-md">
        {/* Logo + Brand */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white mb-6">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">SalesFlow</h1>
          <p className="text-[15px] text-[#666]">Walk in. Pitch. Sell.</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#0a0a0a] rounded-2xl border border-[#333] p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-[13px] font-medium text-white mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full px-4 py-3 text-[15px] bg-[#111] border border-[#333] rounded-lg text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="pin" className="block text-[13px] font-medium text-white mb-2">
                PIN
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                required
                className="w-full px-4 py-3 text-[15px] bg-[#111] border border-[#333] rounded-lg text-white placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-[13px] text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-3 px-4 rounded-lg text-[15px] font-medium hover:bg-[#ededed] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Signup Link */}
          <div className="mt-8 pt-6 border-t border-[#222] text-center">
            <p className="text-[13px] text-[#999]">
              New here?{' '}
              <a
                href="/signup"
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors"
              >
                Create an account
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-[#666] tracking-wide uppercase">
            Independent Sales Platform
          </p>
        </div>
      </div>
    </div>
  );
}
