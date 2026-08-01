import { WorkInterval } from './models';

/** Duration of a single interval in milliseconds (clamped to >= 0). */
export function intervalDurationMs(iv: WorkInterval): number {
  return Math.max(0, iv.endMs - iv.startMs);
}

/**
 * Clip an interval to the inclusive `[fromMs, toMs]` period.
 * Returns `null` when the interval falls entirely outside the period.
 */
export function clipInterval(
  iv: WorkInterval,
  fromMs: number,
  toMs: number,
): WorkInterval | null {
  const start = Math.max(iv.startMs, fromMs);
  const end = Math.min(iv.endMs, toMs);
  if (end < start) {
    return null;
  }
  return { startMs: start, endMs: end };
}

/**
 * Additive sum of interval durations (overlaps are counted multiple times),
 * each interval clipped to `[fromMs, toMs]`.
 */
export function sumDurationsMs(
  intervals: readonly WorkInterval[],
  fromMs: number,
  toMs: number,
): number {
  let total = 0;
  for (const iv of intervals) {
    const clipped = clipInterval(iv, fromMs, toMs);
    if (clipped) {
      total += intervalDurationMs(clipped);
    }
  }
  return total;
}

/**
 * Merge overlapping/adjacent intervals into a disjoint, sorted union.
 * Used to determine when *any* agent is active.
 */
export function mergeIntervals(
  intervals: readonly WorkInterval[],
): WorkInterval[] {
  const valid = intervals
    .filter((iv) => iv.endMs > iv.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const merged: WorkInterval[] = [];
  for (const iv of valid) {
    const last = merged[merged.length - 1];
    if (last && iv.startMs <= last.endMs) {
      if (iv.endMs > last.endMs) {
        merged[merged.length - 1] = { startMs: last.startMs, endMs: iv.endMs };
      }
    } else {
      merged.push({ startMs: iv.startMs, endMs: iv.endMs });
    }
  }
  return merged;
}

/**
 * Subtract `holes` (e.g. agent-active intervals) from `base`, returning the
 * portions of `base` not covered by any hole.
 */
export function subtractIntervals(
  base: WorkInterval,
  holes: readonly WorkInterval[],
): WorkInterval[] {
  const merged = mergeIntervals(holes);
  const result: WorkInterval[] = [];
  let cursor = base.startMs;
  for (const hole of merged) {
    if (hole.endMs <= cursor || hole.startMs >= base.endMs) {
      continue;
    }
    if (hole.startMs > cursor) {
      result.push({ startMs: cursor, endMs: Math.min(hole.startMs, base.endMs) });
    }
    cursor = Math.max(cursor, hole.endMs);
    if (cursor >= base.endMs) {
      break;
    }
  }
  if (cursor < base.endMs) {
    result.push({ startMs: cursor, endMs: base.endMs });
  }
  return result;
}

/**
 * Cluster sorted event timestamps into agent work intervals. Consecutive
 * timestamps within `gapMs` of each other belong to the same working burst;
 * a gap larger than `gapMs` starts a new burst. Isolated single timestamps
 * produce zero-length intervals (they still mark activity boundaries).
 */
export function clusterTimestamps(
  timestampsMs: readonly number[],
  gapMs: number,
): WorkInterval[] {
  const sorted = [...timestampsMs].sort((a, b) => a - b);
  const clusters: WorkInterval[] = [];
  let start: number | null = null;
  let prev: number | null = null;
  for (const ts of sorted) {
    if (start === null || prev === null) {
      start = ts;
      prev = ts;
      continue;
    }
    if (ts - prev > gapMs) {
      clusters.push({ startMs: start, endMs: prev });
      start = ts;
    }
    prev = ts;
  }
  if (start !== null && prev !== null) {
    clusters.push({ startMs: start, endMs: prev });
  }
  return clusters;
}
