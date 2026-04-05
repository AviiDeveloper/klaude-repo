import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { COLLECTIONS, type Collection } from './collections';

export interface VaultNode {
  id: string; // "collection:relativePath"
  collection: string;
  relativePath: string;
  title: string;
  tags: string[];
  wikilinks: string[];
  frontmatter: Record<string, unknown>;
  contentPreview: string; // first 200 chars for search
}

export interface TreeEntry {
  name: string;
  path: string; // relative
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

export interface CollectionTree {
  id: string;
  label: string;
  icon: string;
  color: string;
  entries: TreeEntry[];
}

export interface GraphNode {
  id: string;
  label: string;
  collection: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface SearchResult {
  id: string;
  collection: string;
  relativePath: string;
  title: string;
  snippet: string;
  tags: string[];
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

let fileIndex: Map<string, VaultNode> = new Map();
let titleMap: Map<string, string> = new Map(); // lowercased title/filename → nodeId
let backlinkMap: Map<string, Set<string>> = new Map();
let initialized = false;

function makeNodeId(collection: string, relativePath: string): string {
  return `${collection}:${relativePath}`;
}

function extractTitle(relativePath: string, frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter.title === 'string') return frontmatter.title;
  const basename = path.basename(relativePath, '.md');
  // Convert kebab-case / snake_case to title
  return basename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

function walkDir(dir: string, relativeTo: string): TreeEntry[] {
  if (!fs.existsSync(dir)) return [];
  const entries: TreeEntry[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    const fullPath = path.join(dir, item.name);
    const relPath = path.relative(relativeTo, fullPath);

    if (item.isDirectory()) {
      const children = walkDir(fullPath, relativeTo);
      if (children.length > 0) {
        entries.push({ name: item.name, path: relPath, type: 'directory', children });
      }
    } else if (item.name.endsWith('.md')) {
      entries.push({ name: item.name, path: relPath, type: 'file' });
    }
  }
  return entries;
}

function indexCollection(collection: Collection): void {
  if (!fs.existsSync(collection.basePath)) return;

  const allFiles = collectMarkdownFiles(collection.basePath, collection.basePath);

  for (const relPath of allFiles) {
    const fullPath = path.join(collection.basePath, relPath);
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const { data: frontmatter, content } = matter(raw);

      const nodeId = makeNodeId(collection.id, relPath);
      const title = extractTitle(relPath, frontmatter as Record<string, unknown>);
      const tags: string[] = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
      const wikilinks = extractWikilinks(content);

      const node: VaultNode = {
        id: nodeId,
        collection: collection.id,
        relativePath: relPath,
        title,
        tags,
        wikilinks,
        frontmatter: frontmatter as Record<string, unknown>,
        contentPreview: content.slice(0, 200).replace(/\n/g, ' '),
      };

      fileIndex.set(nodeId, node);

      // Register in titleMap: both title and filename (without ext)
      const basename = path.basename(relPath, '.md').toLowerCase();
      titleMap.set(basename, nodeId);
      titleMap.set(title.toLowerCase(), nodeId);
    } catch {
      // Skip files that can't be read
    }
  }
}

function collectMarkdownFiles(dir: string, basePath: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...collectMarkdownFiles(full, basePath));
    } else if (item.name.endsWith('.md')) {
      files.push(path.relative(basePath, full));
    }
  }
  return files;
}

function buildBacklinks(): void {
  backlinkMap.clear();
  for (const [nodeId, node] of Array.from(fileIndex.entries())) {
    for (const wikilink of node.wikilinks) {
      const targetId = resolveWikilink(wikilink, node.collection);
      if (targetId) {
        if (!backlinkMap.has(targetId)) {
          backlinkMap.set(targetId, new Set());
        }
        backlinkMap.get(targetId)!.add(nodeId);
      }
    }
  }
}

export function resolveWikilink(target: string, preferredCollection?: string): string | null {
  const lower = target.toLowerCase();

  // Prefer same-collection match
  if (preferredCollection) {
    for (const [key, nodeId] of Array.from(titleMap.entries())) {
      if (key === lower && nodeId.startsWith(preferredCollection + ':')) {
        return nodeId;
      }
    }
  }

  // Fall back to any collection
  return titleMap.get(lower) || null;
}

export function buildIndex(): void {
  fileIndex = new Map();
  titleMap = new Map();
  backlinkMap = new Map();

  for (const collection of COLLECTIONS) {
    indexCollection(collection);
  }

  buildBacklinks();
  initialized = true;
}

export function ensureIndex(): void {
  if (!initialized) buildIndex();
}

export function getTree(): CollectionTree[] {
  ensureIndex();
  return COLLECTIONS.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    color: c.color,
    entries: fs.existsSync(c.basePath) ? walkDir(c.basePath, c.basePath) : [],
  }));
}

export function getFileContent(collectionId: string, relativePath: string): {
  content: string;
  frontmatter: Record<string, unknown>;
  title: string;
  tags: string[];
  backlinks: { id: string; title: string; collection: string }[];
  wikilinks: string[];
  wikilinkMap: Record<string, string>; // target text → nodeId
} | null {
  ensureIndex();
  const collection = COLLECTIONS.find((c) => c.id === collectionId);
  if (!collection) return null;

  const fullPath = path.join(collection.basePath, relativePath);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);

  const nodeId = makeNodeId(collectionId, relativePath);
  const node = fileIndex.get(nodeId);
  const title = node?.title || extractTitle(relativePath, frontmatter as Record<string, unknown>);
  const tags: string[] = node?.tags || [];
  const wikilinks = extractWikilinks(content);

  // Build wikilink resolution map for client
  const wikilinkMap: Record<string, string> = {};
  for (const wl of wikilinks) {
    const resolved = resolveWikilink(wl, collectionId);
    if (resolved) wikilinkMap[wl] = resolved;
  }

  // Get backlinks
  const backlinkIds = backlinkMap.get(nodeId);
  const backlinks = backlinkIds
    ? Array.from(backlinkIds).map((blId) => {
        const blNode = fileIndex.get(blId);
        return {
          id: blId,
          title: blNode?.title || blId,
          collection: blNode?.collection || '',
        };
      })
    : [];

  return { content, frontmatter: frontmatter as Record<string, unknown>, title, tags, backlinks, wikilinks, wikilinkMap };
}

export function searchFiles(query: string): SearchResult[] {
  ensureIndex();
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const [, node] of Array.from(fileIndex.entries())) {
    const titleMatch = node.title.toLowerCase().includes(lower);
    const tagMatch = node.tags.some((t) => t.toLowerCase().includes(lower));
    const contentMatch = node.contentPreview.toLowerCase().includes(lower);

    if (titleMatch || tagMatch || contentMatch) {
      let snippet = '';
      if (contentMatch) {
        const idx = node.contentPreview.toLowerCase().indexOf(lower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(node.contentPreview.length, idx + query.length + 40);
        snippet = (start > 0 ? '...' : '') + node.contentPreview.slice(start, end) + (end < node.contentPreview.length ? '...' : '');
      } else {
        snippet = node.contentPreview.slice(0, 100) + '...';
      }

      results.push({
        id: node.id,
        collection: node.collection,
        relativePath: node.relativePath,
        title: node.title,
        snippet,
        tags: node.tags,
      });
    }
  }

  // Sort: title matches first, then tag matches, then content matches
  results.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(lower) ? 0 : 1;
    const bTitle = b.title.toLowerCase().includes(lower) ? 0 : 1;
    return aTitle - bTitle;
  });

  return results.slice(0, 30);
}

export function getGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  ensureIndex();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const [, node] of Array.from(fileIndex.entries())) {
    nodes.push({
      id: node.id,
      label: node.title,
      collection: node.collection,
      tags: node.tags,
    });

    for (const wl of node.wikilinks) {
      const targetId = resolveWikilink(wl, node.collection);
      if (targetId) {
        edges.push({ source: node.id, target: targetId });
      }
    }
  }

  // Also add edges from frontmatter "related" fields
  for (const [, node] of Array.from(fileIndex.entries())) {
    if (Array.isArray(node.frontmatter.related)) {
      for (const rel of node.frontmatter.related) {
        if (typeof rel === 'string') {
          // Try to resolve relative path
          const basename = path.basename(rel, '.md').toLowerCase();
          const targetId = titleMap.get(basename);
          if (targetId && targetId !== node.id) {
            // Avoid duplicate edges
            const exists = edges.some(
              (e) => (e.source === node.id && e.target === targetId) || (e.source === targetId && e.target === node.id)
            );
            if (!exists) {
              edges.push({ source: node.id, target: targetId });
            }
          }
        }
      }
    }
  }

  return { nodes, edges };
}

export function getAllTags(): string[] {
  ensureIndex();
  const tagSet = new Set<string>();
  for (const [, node] of Array.from(fileIndex.entries())) {
    for (const tag of node.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
