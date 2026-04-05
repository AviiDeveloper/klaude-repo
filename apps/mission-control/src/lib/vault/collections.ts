import path from 'path';
import { expandHomePath } from '../path-security';

export interface Collection {
  id: string;
  label: string;
  basePath: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind accent class
}

const REPO_ROOT = path.resolve(process.cwd(), '../..');

export const COLLECTIONS: Collection[] = [
  {
    id: 'knowledge',
    label: 'Knowledge',
    basePath: path.join(REPO_ROOT, 'knowledge'),
    icon: 'BookOpen',
    color: 'mc-accent-cyan',
  },
  {
    id: 'vault',
    label: 'Vault',
    basePath: expandHomePath('~/Desktop/klaude-vault'),
    icon: 'Lock',
    color: 'mc-accent-purple',
  },
  {
    id: 'changelog',
    label: 'Changelog',
    basePath: path.join(REPO_ROOT, 'CHANGELOG'),
    icon: 'History',
    color: 'mc-accent-green',
  },
  {
    id: 'adr',
    label: 'ADR',
    basePath: path.join(REPO_ROOT, 'ADR'),
    icon: 'FileText',
    color: 'mc-accent-yellow',
  },
];

export function getCollection(id: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.id === id);
}
