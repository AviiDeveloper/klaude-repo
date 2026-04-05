'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useVaultStore } from '@/lib/vault-store';
import type { Components } from 'react-markdown';

// Custom component overrides for react-markdown
function useMarkdownComponents(): Components {
  const { openFile, activeFile } = useVaultStore();

  return {
    // Override links to handle wikilinks
    a: ({ href, children, ...props }) => {
      const wikilinkTarget = (props as Record<string, unknown>)['data-wikilink'] as string | undefined;
      if (wikilinkTarget) {
        const [col, ...pathParts] = wikilinkTarget.split(':');
        const filePath = pathParts.join(':');
        return (
          <button
            className="text-mc-accent-cyan hover:underline cursor-pointer"
            onClick={() => void openFile(col, filePath)}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} className="text-mc-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
    // Style tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-mc-border text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 bg-mc-bg-tertiary border border-mc-border text-left text-mc-text font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 border border-mc-border text-mc-text-secondary">{children}</td>
    ),
    // Code blocks
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-mc-bg-tertiary rounded text-mc-accent-cyan text-[0.85em]" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-mc-bg-tertiary rounded-lg p-4 my-4 overflow-x-auto text-xs border border-mc-border">
        {children}
      </pre>
    ),
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-mc-accent-purple pl-4 my-4 text-mc-text-secondary italic">
        {children}
      </blockquote>
    ),
    // Headings
    h1: ({ children }) => (
      <h1 className="text-xl font-bold text-mc-text mt-6 mb-3 pb-2 border-b border-mc-border">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold text-mc-text mt-5 mb-2 pb-1 border-b border-mc-border/50">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-mc-text mt-4 mb-2">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-semibold text-mc-text mt-3 mb-1">{children}</h4>
    ),
    // Lists
    ul: ({ children }) => <ul className="list-disc list-outside ml-5 my-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-outside ml-5 my-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-mc-text-secondary text-sm">{children}</li>,
    // Paragraphs
    p: ({ children }) => <p className="my-2 text-sm leading-relaxed text-mc-text-secondary">{children}</p>,
    // Horizontal rule
    hr: () => <hr className="my-6 border-mc-border" />,
    // Images
    img: ({ src, alt }) => (
      <img src={src} alt={alt || ''} className="max-w-full rounded-lg border border-mc-border my-4" />
    ),
  };
}

// Transform wikilinks in raw markdown before rendering
function transformWikilinks(content: string, wikilinkMap: Record<string, string>): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (match, target: string) => {
    const resolved = wikilinkMap[target.trim()];
    if (resolved) {
      return `[${target}](wikilink://${resolved})`;
    }
    // Unresolved wikilink — render as dimmed text
    return `*\\[\\[${target}\\]\\]*`;
  });
}

export function MarkdownViewer() {
  const { activeFile, isLoading } = useVaultStore();
  const components = useMarkdownComponents();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-mc-text-secondary text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4 opacity-30">{"{ }"}</div>
          <div className="text-mc-text-secondary text-sm">
            Select a file from the sidebar to view its contents.
          </div>
          <div className="text-mc-text-secondary text-xs mt-2 opacity-60">
            Browse knowledge docs, decision journal, changelogs, and ADRs.
          </div>
        </div>
      </div>
    );
  }

  const transformedContent = transformWikilinks(activeFile.content, activeFile.wikilinkMap);

  // Custom link handler for wikilinks
  const componentsWithWikilinks: Components = {
    ...components,
    a: ({ href, children, ...props }) => {
      if (href?.startsWith('wikilink://')) {
        const target = href.replace('wikilink://', '');
        const [col, ...pathParts] = target.split(':');
        const filePath = pathParts.join(':');
        return (
          <button
            className="text-mc-accent-cyan hover:underline cursor-pointer font-medium"
            onClick={() => void useVaultStore.getState().openFile(col, filePath)}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} className="text-mc-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Title bar */}
      <div className="sticky top-0 bg-mc-bg-secondary border-b border-mc-border px-6 py-3 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-mc-text-secondary bg-mc-bg-tertiary px-2 py-0.5 rounded">
            {activeFile.collection}
          </span>
          <span className="text-xs text-mc-text-secondary">/</span>
          <span className="text-sm font-medium text-mc-text">{activeFile.title}</span>
        </div>
        {activeFile.tags.length > 0 && (
          <div className="flex gap-1.5 mt-1.5">
            {activeFile.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-mc-accent-purple/15 text-mc-accent-purple border border-mc-accent-purple/30">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Frontmatter display */}
      {Object.keys(activeFile.frontmatter).length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-mc-bg-tertiary rounded-lg border border-mc-border">
          <div className="text-[10px] uppercase tracking-wider text-mc-text-secondary mb-2">Frontmatter</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(activeFile.frontmatter).map(([key, value]) => {
              if (key === 'tags') return null; // Already shown above
              return (
                <div key={key} className="text-xs">
                  <span className="text-mc-text-secondary">{key}:</span>{' '}
                  <span className="text-mc-text">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Markdown content */}
      <div className="px-6 py-4 vault-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={componentsWithWikilinks}
        >
          {transformedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
