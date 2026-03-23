'use client';

import { useState } from 'react';
import { X, Monitor, PoundSterling, ChevronDown, ChevronUp, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Full-screen Demo Viewer
// ---------------------------------------------------------------------------

export function DemoViewer({
  domain,
  businessName,
  onClose,
}: {
  domain: string;
  businessName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <span className="text-sm font-medium text-primary truncate">{businessName}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white transition-colors"
        >
          <X className="w-4 h-4 text-muted" />
        </button>
      </div>
      {/* Site iframe */}
      <iframe
        src={`/api/files?lead=preview-${domain}&file=site.html`}
        className="flex-1 w-full border-none"
        title={`${businessName} demo site`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price Breakdown
// ---------------------------------------------------------------------------

const PRICE_ITEMS = [
  { label: 'Custom-designed website', price: 200, included: true },
  { label: 'Mobile responsive design', price: 0, included: true },
  { label: 'Google Maps integration', price: 0, included: true },
  { label: 'Contact forms & click-to-call', price: 0, included: true },
  { label: 'SEO optimisation', price: 50, included: true },
  { label: 'Domain name (1 year)', price: 15, included: true },
  { label: 'SSL security certificate', price: 0, included: true },
  { label: 'Professional setup & launch', price: 85, included: true },
];

const MONTHLY_ITEMS = [
  { label: 'Hosting & maintenance', included: true },
  { label: 'Security updates', included: true },
  { label: 'Email support', included: true },
  { label: 'Content updates (2/month)', included: true },
];

export function PriceBreakdown() {
  const [expanded, setExpanded] = useState(false);
  const total = PRICE_ITEMS.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <PoundSterling className="w-4 h-4 text-muted" />
          <span className="text-sm font-medium text-primary">Price breakdown</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">&pound;{total} + &pound;25/mo</span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border-light">
          {/* One-time costs */}
          <div className="px-4 pt-3 pb-2">
            <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">One-time setup</h4>
            <div className="space-y-1.5">
              {PRICE_ITEMS.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-status-sold" />
                    <span className="text-xs text-secondary">{item.label}</span>
                  </div>
                  {item.price > 0 && (
                    <span className="text-xs text-muted">&pound;{item.price}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-light">
              <span className="text-sm font-semibold text-primary">Total setup</span>
              <span className="text-sm font-bold text-primary">&pound;{total}</span>
            </div>
          </div>

          {/* Monthly */}
          <div className="px-4 pt-3 pb-3 bg-surface">
            <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">&pound;25/month includes</h4>
            <div className="space-y-1.5">
              {MONTHLY_ITEMS.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-status-sold" />
                  <span className="text-xs text-secondary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
