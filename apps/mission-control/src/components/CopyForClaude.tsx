'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import type { FlowchartNode } from '@/lib/flowchart-data';
import type { PipelineArtifact, PipelineRun } from '@/hooks/usePipelineArtifacts';
import { nodeLabel } from './ArtifactViewer';

function summariseArtifact(nodeId: string, data: Record<string, unknown>): string {
  switch (nodeId) {
    case 'scout': {
      const leads = (data.leads ?? []) as Array<Record<string, unknown>>;
      const lines = [`Found ${data.lead_count} leads in "${data.location}"`];
      for (const lead of leads.slice(0, 10)) {
        const rating = lead.google_rating ? ` (${lead.google_rating}★, ${lead.google_review_count} reviews)` : '';
        const site = lead.website_url ? ' [has website]' : ' [no website]';
        lines.push(`  - ${lead.business_name}${rating}${site} — ${lead.vertical_category}`);
      }
      if (leads.length > 10) lines.push(`  ... and ${leads.length - 10} more`);
      return lines.join('\n');
    }
    case 'brand-analyse': {
      const analyses = (data.analyses ?? []) as Array<Record<string, unknown>>;
      const lines = [`${analyses.length} leads analysed`];
      for (const a of analyses.slice(0, 5)) {
        const colours = a.colours as Record<string, string> | undefined;
        const services = (a.services ?? []) as string[];
        lines.push(`  - ${a.lead_id}: primary=${colours?.primary ?? '?'}, ${services.length} services, assets=${a.has_sufficient_assets ? 'yes' : 'no'}`);
      }
      return lines.join('\n');
    }
    case 'brand-intelligence': {
      const items = (data.intelligence ?? []) as Array<Record<string, unknown>>;
      const lines = [`${items.length} leads with brand intelligence`];
      for (const intel of items.slice(0, 5)) {
        const usps = (intel.unique_selling_points ?? []) as string[];
        lines.push(`  - ${intel.lead_id}: "${intel.suggested_headline}" — ${intel.market_position}, tone: ${intel.tone}`);
        if (usps.length > 0) lines.push(`    USPs: ${usps.join(', ')}`);
      }
      return lines.join('\n');
    }
    case 'qualify': {
      const qualified = (data.qualified ?? []) as Array<Record<string, unknown>>;
      const rejected = (data.rejected ?? []) as Array<Record<string, unknown>>;
      const lines = [`${qualified.length} qualified, ${rejected.length} rejected, avg score: ${Math.round(data.avg_score as number)}`];
      for (const q of qualified.slice(0, 5)) {
        lines.push(`  + ${q.business_name}: score ${q.qualification_score}`);
      }
      for (const r of rejected.slice(0, 3)) {
        lines.push(`  - ${r.business_name}: ${r.rejection_reason}`);
      }
      return lines.join('\n');
    }
    case 'compose': {
      const sites = (data.sites ?? []) as Array<Record<string, unknown>>;
      const lines = [`${sites.length} sites generated`];
      for (const s of sites) {
        lines.push(`  - ${s.site_name} (${s.sections_count} sections, ${s.hero_variant} hero, ${s.font_pairing})`);
        if (s.html_output) lines.push(`    HTML: ${((s.html_output as string).length / 1024).toFixed(1)}KB`);
      }
      return lines.join('\n');
    }
    case 'qa': {
      const results = (data.results ?? []) as Array<Record<string, unknown>>;
      const lines = [`${data.pass_count} passed, ${data.fail_count} failed, avg score: ${Math.round(data.avg_score as number)}`];
      for (const r of results) {
        const issues = (r.issues ?? []) as Array<Record<string, string>>;
        const errors = issues.filter((is) => is.severity === 'error');
        lines.push(`  ${r.passed ? '✓' : '✗'} ${r.site_name}: score ${r.score}, ${errors.length} errors, ${issues.length - errors.length} warnings`);
        for (const e of errors) {
          lines.push(`    [${e.category}] ${e.message}`);
        }
      }
      return lines.join('\n');
    }
    default:
      return JSON.stringify(data, null, 2).slice(0, 2000);
  }
}

interface CopyForClaudeProps {
  node: FlowchartNode;
  artifacts: PipelineArtifact[];
  latestRun: PipelineRun | null;
}

export function CopyForClaude({ node, artifacts, latestRun }: CopyForClaudeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const lines: string[] = [
      `## Pipeline Node: ${node.label}`,
      `Node ID: ${node.id} | Status: ${node.status} | Type: ${node.type}`,
      `Run: ${latestRun?.id ?? 'unknown'} | ${latestRun?.started_at ?? ''}`,
      '',
    ];

    if (node.connectionIssues && node.connectionIssues.length > 0) {
      lines.push('### Known Wiring Issues');
      for (const issue of node.connectionIssues) {
        lines.push(`- ${issue}`);
      }
      lines.push('');
    }

    for (const artifact of artifacts) {
      lines.push(`### Agent Output: ${nodeLabel(artifact.node_id)}`);
      lines.push('');
      lines.push(summariseArtifact(artifact.node_id, artifact.value_json));
      lines.push('');
    }

    lines.push('### What I want to improve');
    lines.push('[describe what needs fixing or improving]');

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node, artifacts, latestRun]);

  return (
    <button
      onClick={handleCopy}
      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded border transition-colors ${
        copied
          ? 'bg-mc-accent-green/10 border-mc-accent-green/30 text-mc-accent-green'
          : 'bg-mc-accent-purple/10 border-mc-accent-purple/30 text-mc-accent-purple hover:bg-mc-accent-purple/20'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied for Claude Code
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy for Claude Code
        </>
      )}
    </button>
  );
}
