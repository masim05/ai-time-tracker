import { describe, it, expect } from 'vitest';
import {
  intervalDurationMs,
  clipInterval,
  sumDurationsMs,
  mergeIntervals,
  subtractIntervals,
  clusterTimestamps,
} from './interval';

describe('interval helpers', () => {
  it('computes duration and clamps negatives to zero', () => {
    expect(intervalDurationMs({ startMs: 0, endMs: 1000 })).toBe(1000);
    expect(intervalDurationMs({ startMs: 5, endMs: 5 })).toBe(0);
    expect(intervalDurationMs({ startMs: 10, endMs: 5 })).toBe(0);
  });

  it('clips intervals to the period, inclusive', () => {
    expect(clipInterval({ startMs: 0, endMs: 100 }, 25, 75)).toEqual({
      startMs: 25,
      endMs: 75,
    });
    expect(clipInterval({ startMs: 0, endMs: 100 }, 200, 300)).toBeNull();
    // touching the boundary is included
    expect(clipInterval({ startMs: 100, endMs: 100 }, 100, 200)).toEqual({
      startMs: 100,
      endMs: 100,
    });
  });

  it('sums durations additively including overlaps', () => {
    const spans = [
      { startMs: 0, endMs: 100 },
      { startMs: 50, endMs: 150 },
    ];
    expect(sumDurationsMs(spans, -Infinity, Infinity)).toBe(200);
  });

  it('merges overlapping intervals into a disjoint union', () => {
    const merged = mergeIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 50, endMs: 150 },
      { startMs: 200, endMs: 250 },
    ]);
    expect(merged).toEqual([
      { startMs: 0, endMs: 150 },
      { startMs: 200, endMs: 250 },
    ]);
  });

  it('subtracts holes from a base interval', () => {
    const gaps = subtractIntervals({ startMs: 0, endMs: 100 }, [
      { startMs: 20, endMs: 40 },
      { startMs: 60, endMs: 80 },
    ]);
    expect(gaps).toEqual([
      { startMs: 0, endMs: 20 },
      { startMs: 40, endMs: 60 },
      { startMs: 80, endMs: 100 },
    ]);
  });

  it('returns the whole base when there are no holes', () => {
    expect(subtractIntervals({ startMs: 0, endMs: 10 }, [])).toEqual([
      { startMs: 0, endMs: 10 },
    ]);
  });

  it('clusters timestamps separated by more than the gap', () => {
    const clusters = clusterTimestamps([0, 1000, 2000, 60000, 61000], 5000);
    expect(clusters).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 60000, endMs: 61000 },
    ]);
  });

  it('clusters a single timestamp into a zero-length interval', () => {
    expect(clusterTimestamps([42], 1000)).toEqual([{ startMs: 42, endMs: 42 }]);
    expect(clusterTimestamps([], 1000)).toEqual([]);
  });
});
