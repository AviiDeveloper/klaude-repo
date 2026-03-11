import path from 'path';

export function expandHomePath(input: string): string {
  const home = process.env.HOME || '';
  if (input.startsWith('~')) {
    return home ? input.replace(/^~(?=$|\/|\\)/, home) : input.replace(/^~/, '');
  }
  return input;
}

export function resolvePath(input: string): string {
  return path.resolve(expandHomePath(input));
}

export function isPathWithinBase(targetPath: string, basePath: string): boolean {
  const resolvedTarget = resolvePath(targetPath);
  const resolvedBase = resolvePath(basePath);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative === '') {
    return true;
  }
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function hasPathTraversal(input: string): boolean {
  const normalized = path.posix.normalize(input.replace(/\\/g, '/'));
  return normalized === '..' || normalized.startsWith('../') || normalized.includes('/../');
}
