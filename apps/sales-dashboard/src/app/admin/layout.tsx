'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock, Home, Upload, UserPlus } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    // Check if we have admin cookie by hitting an admin endpoint
    fetch('/api/admin/salespeople').then(res => {
      setAuthed(res.ok);
    });
  }, []);

  const handleLogin = async () => {
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setAuthed(true);
    } else {
      setError('Wrong password');
    }
  };

  if (authed === null) return null; // loading

  if (!authed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-sm p-8">
          <div className="flex items-center justify-center mb-8">
            <Lock className="w-8 h-8 text-white/30" />
          </div>
          <h1 className="text-xl font-semibold text-white text-center mb-6">Admin Access</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg text-[15px] focus:border-white outline-none transition-colors mb-4"
          />
          {error && <p className="text-red-400 text-[13px] mb-4">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-white text-black py-3 rounded-lg text-[15px] font-medium hover:bg-[#ededed] transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/upload', label: 'Upload Demo', icon: Upload },
    { href: '/admin/assign', label: 'Assign Lead', icon: UserPlus },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-[#222] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-[15px] font-semibold">SalesFlow Admin</span>
          <nav className="flex gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                  pathname === href ? 'bg-white/10 text-white' : 'text-[#888] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="p-6 max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );
}
