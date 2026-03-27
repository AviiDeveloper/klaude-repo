# Design Brief: Customer Demo Page

## What this page is
This is the page a **business owner** sees when a salesperson shares a link with them (e.g. `salesflow.co.uk/demo/abc123`). It shows a preview of a website we've built for their business. The goal is to get them to buy it.

## Tech stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- `lucide-react` for icons (optional — only if needed)
- No external UI libraries

## Current file
`apps/sales-dashboard/src/app/demo/[code]/page.tsx`

## Current code (full file)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Loader2, Globe } from 'lucide-react';

interface DemoData {
  business_name: string;
  demo_domain: string | null;
  status: string;
}

export default function CustomerDemoPage() {
  const params = useParams();
  const code = params.code as string;
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'viewing' | 'buying' | 'done'>('viewing');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch(`/api/demo-links/${code}`)
      .then(r => {
        if (r.status === 410) throw new Error('expired');
        if (r.status === 404) throw new Error('not_found');
        return r.json();
      })
      .then(d => setDemo(d.data))
      .catch(e => setError(e.message === 'expired' ? 'expired' : 'not_found'))
      .finally(() => setLoading(false));
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/demo-links/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
    } catch { /* */ }
    setSubmitting(false);
    setPhase('done');
  }

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-[32px] font-semibold text-neutral-900 tracking-tight mb-3">
            {error === 'expired' ? 'Link expired.' : 'Not found.'}
          </p>
          <p className="text-[15px] text-neutral-400 leading-relaxed">
            Ask the person who shared this with you for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const demoSiteUrl = demo.demo_domain ? `/demo-sites/${demo.demo_domain}.html` : null;
  const firstName = name.split(' ')[0];

  return (
    <div className="h-screen bg-white relative overflow-hidden">

      {/* Demo site — full viewport */}
      {demoSiteUrl ? (
        <iframe
          src={demoSiteUrl}
          className="w-full h-full border-0"
          title={demo.business_name}
        />
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-[17px] text-neutral-400">Your website is being prepared.</p>
          </div>
        </div>
      )}

      {/* ── CTA button ── */}
      {phase === 'viewing' && (
        <button
          onClick={() => setPhase('buying')}
          className={`
            fixed bottom-8 left-1/2 -translate-x-1/2 z-50
            bg-neutral-900 text-white
            px-7 py-3.5 rounded-full
            text-[15px] font-medium tracking-[-0.01em]
            shadow-[0_2px_20px_rgba(0,0,0,0.15)]
            hover:bg-neutral-800
            active:scale-[0.97]
            transition-all duration-200
            ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
          `}
          style={{ transitionProperty: 'opacity, transform, background-color', transitionDuration: visible ? '0.6s' : '0s' }}
        >
          Get this website
        </button>
      )}

      {/* ── Confirmation ── */}
      {phase === 'done' && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-7 py-3.5 rounded-full text-[15px] font-medium shadow-[0_2px_20px_rgba(0,0,0,0.15)]"
        >
          We&apos;ll be in touch{firstName ? `, ${firstName}` : ''}.
        </div>
      )}

      {/* ── Purchase sheet ── */}
      {phase === 'buying' && (
        <>
          <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setPhase('viewing')} />

          <div className="fixed bottom-0 inset-x-0 z-50 sheet-enter">
            <div className="bg-white rounded-t-[20px]">
              <div className="mx-auto max-w-[380px] px-6 pt-3 pb-10">

                {/* Drag handle */}
                <div className="w-9 h-[5px] bg-neutral-200 rounded-full mx-auto mb-8" />

                {/* Title */}
                <h2 className="text-[22px] font-semibold text-neutral-900 tracking-tight text-center mb-1">
                  Get this website
                </h2>
                <p className="text-[15px] text-neutral-400 text-center mb-8">
                  £350 setup · £25/mo
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  <div className="space-y-2 mb-6">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Name"
                      required
                      autoFocus
                      className="w-full bg-neutral-100 rounded-xl py-3.5 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-900/5 transition-shadow"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Phone"
                      required
                      className="w-full bg-neutral-100 rounded-xl py-3.5 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-900/5 transition-shadow"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !phone.trim()}
                    className="w-full bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-30 transition-colors"
                  >
                    {submitting ? 'Sending...' : 'Continue'}
                  </button>

                  <p className="text-[13px] text-neutral-300 text-center mt-4">
                    We'll call to confirm. No payment taken now.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes sheetEnter {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .sheet-enter {
          animation: sheetEnter 0.45s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
```

## What the page does (behaviour to preserve)

1. **Fetches demo data** from `/api/demo-links/{code}` on load — returns `{ business_name, demo_domain, status }`
2. **Shows the demo site** in a full-viewport iframe (`/demo-sites/{demo_domain}.html`)
3. **Shows a floating CTA button** that fades in after 2 seconds
4. **Clicking the CTA** opens a bottom sheet purchase form over the demo (demo stays visible behind a dim overlay)
5. **Form collects** name + phone number only
6. **Submitting** POSTs to `/api/demo-links/{code}` with `{ name, phone }`
7. **After submit** the sheet closes and a confirmation pill replaces the CTA
8. **Error states**: "Link expired." and "Not found." with a message to contact the sharer
9. **No sidebar, no navigation, no auth** — this is a standalone public page

## Three visual states

### State 1: Viewing
- Full-screen iframe showing the demo website
- Floating CTA button at bottom centre
- Nothing else on screen

### State 2: Buying (bottom sheet open)
- Demo site visible behind a dim overlay
- Bottom sheet slides up with: title, price, name input, phone input, submit button, reassurance text
- Clicking the overlay closes the sheet

### State 3: Done
- Demo site visible (no overlay)
- Confirmation pill at bottom centre replacing the CTA

## Design direction

I want this page to feel **premium, elegant, and simple** — like Apple, Stripe, or Linear. Not "vibe coded". The demo website itself is the product — the UI around it should be invisible. The business owner should feel like they're looking at their own website, with a subtle, beautiful prompt to buy it.

Key principles:
- The demo iframe should dominate — everything else is overlay
- The CTA should be noticeable but not aggressive
- The purchase sheet should feel like a natural extension, not a modal interruption
- Typography and spacing should do the design work, not colours/icons/gradients
- Animations should be felt, not seen

## Constraints
- Must be a single React component (page.tsx) using `'use client'`
- Must use Tailwind CSS classes (Tailwind is already configured)
- Can use `lucide-react` icons if needed
- Must preserve all the functional behaviour listed above
- Must use `useParams()` from `next/navigation` to get the `code` param
- The `{'\u00A3'}` is used for the £ symbol in JSX
- The `&apos;` is used for apostrophes in JSX
- Keep `<style jsx>` for the sheet animation

## What I want back
The complete `page.tsx` file with your redesign. I'll drop it straight into `apps/sales-dashboard/src/app/demo/[code]/page.tsx`.
