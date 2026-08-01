/**
 * Pure path-string helpers (no file-system access). Paths are treated as POSIX
 * absolute paths as stored by the providers; symlinks are never resolved.
 */

/** Normalizes a path by collapsing duplicate slashes and trailing slashes. */
export function normalizePath(p: string): string {
  if (!p) {
    return p;
  }
  const collapsed = p.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

/** True when `child` is the same directory as, or nested under, `parent`. */
export function isUnderOrEqual(child: string, parent: string): boolean {
  const c = normalizePath(child);
  const p = normalizePath(parent);
  if (c === p) {
    return true;
  }
  return c.startsWith(p.endsWith('/') ? p : p + '/');
}
