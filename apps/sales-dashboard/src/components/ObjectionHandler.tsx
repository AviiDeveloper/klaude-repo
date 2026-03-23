'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import clsx from 'clsx';

interface Objection {
  objection: string;
  response: string;
}

const OBJECTIONS: Objection[] = [
  {
    objection: "I don't need a website",
    response: "Over 80% of customers search online before visiting a local business. Without a website, you're invisible to them. Your competitors who do have one are getting those customers right now.",
  },
  {
    objection: "It's too expensive",
    response: "It's less than £1 a day for hosting. The setup fee pays for itself if it brings in just one extra customer. Most businesses see that within the first week.",
  },
  {
    objection: "I get enough business through word of mouth",
    response: "Word of mouth is great — a website amplifies it. When someone recommends you, the first thing people do is Google you. If nothing comes up, you lose that referral.",
  },
  {
    objection: "I already have a Facebook page",
    response: "Facebook is useful, but you don't own it — they control who sees your posts. A website is yours. It also ranks on Google, which Facebook pages often don't for local searches.",
  },
  {
    objection: "I need to think about it",
    response: "Of course. What specifically would help you decide? I can leave you the demo to look at on your phone — it's already built with your business details and real photos.",
  },
  {
    objection: "Can I do it myself?",
    response: "You could, but it takes 40-60 hours to build something professional. Your time is better spent running your business. We handle everything — design, hosting, updates — so you don't have to.",
  },
];

export function ObjectionHandler() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="w-3.5 h-3.5 text-muted" />
        <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest">Common objections</h4>
      </div>
      <div className="divide-y divide-border-light border border-border rounded-lg overflow-hidden">
        {OBJECTIONS.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface transition-colors"
            >
              <span className={clsx(
                'text-sm',
                open === i ? 'font-medium text-primary' : 'text-secondary',
              )}>
                &ldquo;{item.objection}&rdquo;
              </span>
              {open === i ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted flex-shrink-0 ml-2" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-faint flex-shrink-0 ml-2" />
              )}
            </button>
            {open === i && (
              <div className="px-3 pb-3 -mt-0.5">
                <p className="text-sm text-secondary leading-relaxed bg-surface rounded-md px-3 py-2">
                  {item.response}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
