'use client';

import { create } from 'zustand';

export interface CollectionTreeEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: CollectionTreeEntry[];
}

export interface CollectionTree {
  id: string;
  label: string;
  icon: string;
  color: string;
  entries: CollectionTreeEntry[];
}

export interface VaultFile {
  collection: string;
  path: string;
  content: string;
  title: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  backlinks: { id: string; title: string; collection: string }[];
  wikilinks: string[];
  wikilinkMap: Record<string, string>;
}

export interface SearchResult {
  id: string;
  collection: string;
  relativePath: string;
  title: string;
  snippet: string;
  tags: string[];
}

interface VaultState {
  // Data
  collections: CollectionTree[] | null;
  activeFile: VaultFile | null;
  searchQuery: string;
  searchResults: SearchResult[];
  activeTags: string[];
  allTags: string[];
  graphVisible: boolean;
  isLoading: boolean;

  // Expanded folders state
  expandedFolders: Set<string>;

  // Actions
  loadTree: () => Promise<void>;
  openFile: (collection: string, path: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  toggleTag: (tag: string) => void;
  toggleGraph: () => void;
  toggleFolder: (folderId: string) => void;
  refreshIndex: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  collections: null,
  activeFile: null,
  searchQuery: '',
  searchResults: [],
  activeTags: [],
  allTags: [],
  graphVisible: false,
  isLoading: false,
  expandedFolders: new Set<string>(),

  loadTree: async () => {
    try {
      const res = await fetch('/api/vault/tree');
      if (!res.ok) return;
      const data = await res.json();
      set({ collections: data.collections });

      // Extract all tags from tree data
      const tagsRes = await fetch('/api/vault/search?q=*');
      if (tagsRes.ok) {
        const searchData = await tagsRes.json();
        const tagSet = new Set<string>();
        for (const r of searchData.results || []) {
          for (const t of r.tags || []) {
            tagSet.add(t);
          }
        }
        set({ allTags: Array.from(tagSet).sort() });
      }
    } catch {
      // ignore
    }
  },

  openFile: async (collection: string, filePath: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/vault/file?collection=${encodeURIComponent(collection)}&path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        set({ isLoading: false });
        return;
      }
      const data = await res.json();
      set({
        activeFile: {
          collection,
          path: filePath,
          content: data.content,
          title: data.title,
          tags: data.tags,
          frontmatter: data.frontmatter,
          backlinks: data.backlinks,
          wikilinks: data.wikilinks,
          wikilinkMap: data.wikilinkMap,
        },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query });
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }
    try {
      const res = await fetch(`/api/vault/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ searchResults: data.results || [] });
    } catch {
      // ignore
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),

  toggleTag: (tag: string) => {
    const { activeTags } = get();
    if (activeTags.includes(tag)) {
      set({ activeTags: activeTags.filter((t) => t !== tag) });
    } else {
      set({ activeTags: [...activeTags, tag] });
    }
  },

  toggleGraph: () => set({ graphVisible: !get().graphVisible }),

  toggleFolder: (folderId: string) => {
    const { expandedFolders } = get();
    const next = new Set(expandedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    set({ expandedFolders: next });
  },

  refreshIndex: async () => {
    await fetch('/api/vault/index', { method: 'POST' });
    await get().loadTree();
  },
}));
