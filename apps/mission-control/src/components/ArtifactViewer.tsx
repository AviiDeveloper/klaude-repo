'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Star, MapPin, Globe, Phone,
  CheckCircle, XCircle, AlertTriangle, Palette, Type,
  Image as ImageIcon, Sparkles, Target, Quote, TrendingUp,
  Monitor, Smartphone,
} from 'lucide-react';
import type { PipelineArtifact } from '@/hooks/usePipelineArtifacts';

const MC_API = process.env.NEXT_PUBLIC_MC_API_URL || 'http://127.0.0.1:4317';

function assetUrl(leadId: string, filename: string): string {
  return `${MC_API}/api/files/download?relativePath=.assets/${leadId}/${filename}&raw=true`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ── Helpers ──

function ColourSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-mc-border flex-shrink-0"
        style={{ backgroundColor: hex }}
      />
      <div>
        <div className="text-[10px] text-mc-text-secondary">{label}</div>
        <div className="text-[11px] font-mono text-mc-text">{hex}</div>
      </div>
    </div>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const colour = pct >= 70 ? '#3fb950' : pct >= 40 ? '#d29922' : '#f85149';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-mc-bg-tertiary rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </div>
      <span className="text-[11px] font-mono font-bold" style={{ color: colour }}>
        {score}
      </span>
    </div>
  );
}

function Collapsible({ title, count, defaultOpen, children }: {
  title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-bold text-mc-text-secondary uppercase mb-1 hover:text-mc-text"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}{count !== undefined ? ` (${count})` : ''}
      </button>
      {open && <div className="ml-1">{children}</div>}
    </div>
  );
}

// ── Scout Viewer ──

function ScoutViewer({ data }: { data: Any }) {
  const leads = (data.leads ?? []) as Any[];
  const breakdown = data.category_breakdown as Record<string, number> | undefined;
  const enrichment = data.enrichment as Record<string, number> | undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px] text-mc-text-secondary">
        <span className="font-bold text-mc-text">{data.lead_count as number} leads</span>
        {typeof data.location === 'string' && <span><MapPin className="w-3 h-3 inline" /> {data.location}</span>}
      </div>

      {breakdown && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(breakdown).map(([cat, count]) => (
            <span key={cat} className="px-2 py-0.5 text-[10px] bg-mc-bg rounded border border-mc-border text-mc-text">
              {cat}: {count}
            </span>
          ))}
        </div>
      )}

      {enrichment && (
        <div className="flex gap-3 text-[10px] text-mc-text-secondary">
          <span>{enrichment.with_website ?? 0} with website</span>
          <span>{enrichment.with_photos ?? 0} with photos</span>
          <span>{enrichment.chains ?? 0} chains filtered</span>
        </div>
      )}

      <Collapsible title="Leads" count={leads.length} defaultOpen={leads.length <= 8}>
        <div className="space-y-2">
          {leads.map((lead, i) => (
            <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-bold text-mc-text">{lead.business_name as string}</div>
                  <div className="text-[10px] text-mc-text-secondary">{lead.business_type as string}</div>
                </div>
                {lead.google_rating && (
                  <div className="flex items-center gap-0.5 text-[10px]">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-mc-text">{lead.google_rating as number}</span>
                    <span className="text-mc-text-secondary">({lead.google_review_count as number})</span>
                  </div>
                )}
              </div>
              {lead.address && (
                <div className="text-[10px] text-mc-text-secondary mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {lead.address as string}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 text-[10px] text-mc-text-secondary">
                {lead.website_url && (
                  <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" /> has site</span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {lead.phone as string}</span>
                )}
                {lead.vertical_category && (
                  <span className="px-1 py-0.5 bg-mc-accent-purple/10 text-mc-accent-purple rounded text-[9px]">
                    {lead.vertical_category as string}
                  </span>
                )}
              </div>
              {/* Photo thumbnails */}
              {lead.google_photo_filenames && (lead.google_photo_filenames as string[]).length > 0 && lead.lead_id && (
                <div className="flex gap-1 mt-1.5 overflow-x-auto">
                  {(lead.google_photo_filenames as string[]).slice(0, 4).map((fn, j) => (
                    <img
                      key={j}
                      src={assetUrl(lead.lead_id as string, fn)}
                      alt={fn}
                      className="w-12 h-12 rounded object-cover border border-mc-border flex-shrink-0"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// ── Brand Analyser Viewer ──

function BrandAnalyserViewer({ data }: { data: Any }) {
  const analyses = (data.analyses ?? []) as Any[];

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-mc-text-secondary">
        {analyses.length} lead{analyses.length !== 1 ? 's' : ''} analysed
        {' — '}
        {(data.sufficient_assets_count as number) ?? 0} with sufficient assets
      </div>

      {analyses.map((a, i) => {
        const colours = a.colours as Record<string, string> | undefined;
        const fonts = a.fonts as Record<string, string> | undefined;
        const inventory = (a.photo_inventory ?? []) as Array<Record<string, unknown>>;
        const services = (a.services ?? []) as string[];

        return (
          <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border space-y-2">
            <div className="text-[11px] font-bold text-mc-text">{a.lead_id as string}</div>

            {colours && (
              <div>
                <div className="flex items-center gap-1 text-[10px] text-mc-text-secondary mb-1">
                  <Palette className="w-3 h-3" /> Colours
                  <span className="text-mc-text-secondary/60">({colours.palette_source})</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {['primary', 'secondary', 'accent', 'background', 'text'].map((k) =>
                    colours[k] ? <ColourSwatch key={k} hex={colours[k]} label={k} /> : null,
                  )}
                </div>
              </div>
            )}

            {fonts && (
              <div className="flex items-center gap-2 text-[10px]">
                <Type className="w-3 h-3 text-mc-text-secondary" />
                <span className="text-mc-text">{fonts.heading}</span>
                <span className="text-mc-text-secondary">/</span>
                <span className="text-mc-text">{fonts.body}</span>
              </div>
            )}

            {inventory.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-mc-text-secondary">
                <ImageIcon className="w-3 h-3" /> {inventory.length} photos
                {a.has_sufficient_assets ? (
                  <CheckCircle className="w-3 h-3 text-mc-accent-green" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-mc-accent-yellow" />
                )}
              </div>
            )}

            {services.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {services.slice(0, 8).map((s, j) => (
                  <span key={j} className="px-1.5 py-0.5 text-[9px] bg-mc-bg-tertiary rounded text-mc-text">
                    {s}
                  </span>
                ))}
                {services.length > 8 && (
                  <span className="text-[9px] text-mc-text-secondary">+{services.length - 8} more</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Brand Intelligence Viewer ──

function BrandIntelligenceViewer({ data }: { data: Any }) {
  const items = (data.intelligence ?? []) as Any[];

  return (
    <div className="space-y-3">
      {items.map((intel, i) => (
        <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border space-y-2">
          <div className="text-[11px] font-bold text-mc-text">{intel.lead_id as string}</div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] bg-mc-accent-purple/10 text-mc-accent-purple rounded font-bold">
              {intel.market_position as string}
            </span>
            <span className="text-[10px] text-mc-text-secondary italic">
              {intel.tone as string}
            </span>
          </div>

          {intel.suggested_headline && (
            <div className="p-2 bg-mc-bg-tertiary rounded">
              <div className="text-[10px] text-mc-text-secondary mb-0.5">Headline</div>
              <div className="text-[12px] font-bold text-mc-text">{intel.suggested_headline as string}</div>
              {intel.suggested_tagline && (
                <div className="text-[10px] text-mc-text-secondary mt-0.5">{intel.suggested_tagline as string}</div>
              )}
            </div>
          )}

          {intel.unique_selling_points && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-mc-text-secondary mb-1">
                <Target className="w-3 h-3" /> USPs
              </div>
              <div className="flex flex-wrap gap-1">
                {(intel.unique_selling_points as string[]).map((usp, j) => (
                  <span key={j} className="px-1.5 py-0.5 text-[9px] bg-mc-accent-green/10 text-mc-accent-green rounded">
                    {usp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intel.voice_examples && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-mc-text-secondary mb-1">
                <Quote className="w-3 h-3" /> Voice
              </div>
              {(intel.voice_examples as string[]).map((ex, j) => (
                <div key={j} className="text-[10px] text-mc-text italic ml-2 mb-0.5">&ldquo;{ex}&rdquo;</div>
              ))}
            </div>
          )}

          {intel.trust_signals && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-mc-text-secondary mb-1">
                <Sparkles className="w-3 h-3" /> Trust signals
              </div>
              <div className="flex flex-wrap gap-1">
                {(intel.trust_signals as string[]).map((ts, j) => (
                  <span key={j} className="px-1.5 py-0.5 text-[9px] bg-mc-accent/10 text-mc-accent rounded">
                    {ts}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Qualifier Viewer ──

function QualifierViewer({ data }: { data: Any }) {
  const qualified = (data.qualified ?? []) as Any[];
  const rejected = (data.rejected ?? []) as Any[];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-mc-accent-green font-bold">
          <CheckCircle className="w-3 h-3 inline mr-0.5" />
          {data.qualified_count as number} qualified
        </span>
        <span className="text-mc-accent-red font-bold">
          <XCircle className="w-3 h-3 inline mr-0.5" />
          {data.rejected_count as number} rejected
        </span>
        <span className="text-mc-text-secondary">
          avg score: {Math.round(data.avg_score as number)}
        </span>
      </div>

      <Collapsible title="Qualified" count={qualified.length} defaultOpen>
        <div className="space-y-1.5">
          {qualified.map((lead, i) => (
            <div key={i} className="p-2 bg-mc-accent-green/5 rounded border border-mc-accent-green/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-mc-text">{lead.business_name as string}</span>
                <span className="text-[11px] font-mono font-bold text-mc-accent-green">
                  {lead.qualification_score as number}
                </span>
              </div>
              <ScoreBar score={lead.qualification_score as number} />
              {lead.qualification_reasons && (
                <div className="mt-1">
                  {(lead.qualification_reasons as string[]).slice(0, 3).map((r, j) => (
                    <div key={j} className="text-[9px] text-mc-text-secondary">+ {r}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Collapsible>

      {rejected.length > 0 && (
        <Collapsible title="Rejected" count={rejected.length}>
          <div className="space-y-1">
            {rejected.map((lead, i) => (
              <div key={i} className="p-1.5 bg-mc-accent-red/5 rounded border border-mc-accent-red/20 text-[10px]">
                <span className="text-mc-text">{lead.business_name as string}</span>
                <span className="text-mc-accent-red ml-2">{lead.rejection_reason as string}</span>
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  );
}

// ── Composer Viewer ──

function ComposerViewer({ data }: { data: Any }) {
  const sites = (data.sites ?? []) as Any[];
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [deviceWidth, setDeviceWidth] = useState<'mobile' | 'desktop'>('desktop');

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-mc-text-secondary">
        {data.generated_count as number} site{(data.generated_count as number) !== 1 ? 's' : ''} generated
      </div>

      {sites.map((site, i) => (
        <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-mc-text">{site.site_name as string}</div>
              <div className="text-[10px] text-mc-text-secondary">{site.domain as string}</div>
            </div>
            <button
              onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
              className="px-2 py-1 text-[10px] bg-mc-accent/10 text-mc-accent rounded border border-mc-accent/30 hover:bg-mc-accent/20"
            >
              {previewIdx === i ? 'Hide preview' : 'Preview HTML'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[9px]">
            {site.sections_count && (
              <span className="px-1.5 py-0.5 bg-mc-bg-tertiary rounded text-mc-text">
                {site.sections_count as number} sections
              </span>
            )}
            {site.hero_variant && (
              <span className="px-1.5 py-0.5 bg-mc-bg-tertiary rounded text-mc-text">
                hero: {site.hero_variant as string}
              </span>
            )}
            {site.font_pairing && (
              <span className="px-1.5 py-0.5 bg-mc-bg-tertiary rounded text-mc-text">
                {site.font_pairing as string}
              </span>
            )}
            {site.ai_generated && (
              <span className="px-1.5 py-0.5 bg-mc-accent-purple/10 text-mc-accent-purple rounded">
                AI generated
              </span>
            )}
          </div>

          {site.design_rationale && (
            <Collapsible title="Design rationale">
              <div className="space-y-0.5">
                {(site.design_rationale as string[]).map((r, j) => (
                  <div key={j} className="text-[10px] text-mc-text-secondary">- {r}</div>
                ))}
              </div>
            </Collapsible>
          )}

          {previewIdx === i && site.html_output && (
            <div className="border border-mc-border rounded overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1 bg-mc-bg-tertiary border-b border-mc-border">
                <button
                  onClick={() => setDeviceWidth('desktop')}
                  className={`p-0.5 rounded ${deviceWidth === 'desktop' ? 'text-mc-accent' : 'text-mc-text-secondary'}`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceWidth('mobile')}
                  className={`p-0.5 rounded ${deviceWidth === 'mobile' ? 'text-mc-accent' : 'text-mc-text-secondary'}`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex justify-center bg-white p-1">
                <iframe
                  srcDoc={site.html_output as string}
                  sandbox="allow-scripts"
                  className="border-0"
                  style={{
                    width: deviceWidth === 'mobile' ? '375px' : '100%',
                    height: '400px',
                  }}
                  title={`Preview: ${site.site_name}`}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── QA Viewer ──

function QAViewer({ data }: { data: Any }) {
  const results = (data.results ?? []) as Any[];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-mc-accent-green font-bold">
          <CheckCircle className="w-3 h-3 inline mr-0.5" />
          {data.pass_count as number} passed
        </span>
        <span className="text-mc-accent-red font-bold">
          <XCircle className="w-3 h-3 inline mr-0.5" />
          {data.fail_count as number} failed
        </span>
        <span className="text-mc-text-secondary">
          avg: {Math.round(data.avg_score as number)}
        </span>
      </div>

      {results.map((r, i) => {
        const issues = (r.issues ?? []) as Array<Record<string, string>>;
        const errors = issues.filter((is) => is.severity === 'error');
        const warnings = issues.filter((is) => is.severity === 'warning');

        return (
          <div key={i} className="p-2 bg-mc-bg rounded border border-mc-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-mc-text">{r.site_name as string}</span>
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                r.passed
                  ? 'bg-mc-accent-green/10 text-mc-accent-green'
                  : 'bg-mc-accent-red/10 text-mc-accent-red'
              }`}>
                {r.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <ScoreBar score={r.score as number} />

            {errors.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-mc-accent-red mb-0.5">
                  Errors ({errors.length})
                </div>
                {errors.map((is, j) => (
                  <div key={j} className="text-[10px] text-mc-accent-red/80 ml-2">
                    [{is.category}] {is.message}
                  </div>
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <Collapsible title={`Warnings`} count={warnings.length}>
                {warnings.map((is, j) => (
                  <div key={j} className="text-[10px] text-mc-accent-yellow/80 ml-2">
                    [{is.category}] {is.message}
                  </div>
                ))}
              </Collapsible>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fallback Viewer ──

function FallbackViewer({ data, label }: { data: Any; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(data, null, 2);
  const truncated = json.length > 3000;
  const display = expanded ? json : json.slice(0, 3000);

  return (
    <div>
      <div className="text-[10px] text-mc-text-secondary mb-1">
        Raw output from <span className="font-mono font-bold">{label}</span>
      </div>
      <pre className="text-[10px] font-mono text-mc-text bg-mc-bg p-2 rounded border border-mc-border overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto">
        {display}
        {truncated && !expanded && '...'}
      </pre>
      {truncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-mc-accent hover:underline mt-1"
        >
          {expanded ? 'Show less' : `Show all (${(json.length / 1024).toFixed(1)}KB)`}
        </button>
      )}
    </div>
  );
}

// ── Router ──

export function ArtifactRouter({ nodeId, artifact }: { nodeId: string; artifact: PipelineArtifact }) {
  const data = artifact.value_json;

  switch (nodeId) {
    case 'scout':
      return <ScoutViewer data={data} />;
    case 'brand-analyse':
      return <BrandAnalyserViewer data={data} />;
    case 'brand-intelligence':
      return <BrandIntelligenceViewer data={data} />;
    case 'qualify':
      return <QualifierViewer data={data} />;
    case 'compose':
      return <ComposerViewer data={data} />;
    case 'qa':
      return <QAViewer data={data} />;
    default:
      return <FallbackViewer data={data} label={nodeId} />;
  }
}

// ── Node label for pipeline node IDs ──

const NODE_LABELS: Record<string, string> = {
  scout: 'Lead Scout',
  profile: 'Lead Profiler',
  'brand-analyse': 'Brand Analyser',
  'brand-intelligence': 'Brand Intelligence',
  qualify: 'Qualifier',
  assign: 'Lead Assigner',
  brief: 'Brief Generator',
  compose: 'Site Composer',
  qa: 'Site QA',
};

export function nodeLabel(nodeId: string): string {
  return NODE_LABELS[nodeId] ?? nodeId;
}
