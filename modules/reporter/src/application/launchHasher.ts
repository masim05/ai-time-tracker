import { createHash } from 'crypto';

const SHORT_LEN = 6;

/** Default short-hash: first {@link SHORT_LEN} hex chars of a SHA-256 digest. */
export function defaultShortHash(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, SHORT_LEN);
}

/**
 * Deterministic short-id assignment for launches.
 *
 * Each full launch id maps to a short id via `hashFn`. When two *distinct* full
 * ids collide on the same short id, every launch that participates in a
 * colliding short id falls back to its full id, so the displayed value stays
 * unambiguous.
 */
export function assignLaunchShortIds(
  fullIds: readonly string[],
  hashFn: (id: string) => string = defaultShortHash,
): Map<string, string> {
  const unique = [...new Set(fullIds)];
  const shortOf = new Map<string, string>();
  const byShort = new Map<string, string[]>();

  for (const id of unique) {
    const short = hashFn(id);
    shortOf.set(id, short);
    const list = byShort.get(short) ?? [];
    list.push(id);
    byShort.set(short, list);
  }

  const result = new Map<string, string>();
  for (const id of unique) {
    const short = shortOf.get(id) as string;
    const colliding = byShort.get(short) as string[];
    result.set(id, colliding.length > 1 ? id : short);
  }
  return result;
}
