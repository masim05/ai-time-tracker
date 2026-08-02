import { describe, it, expect } from 'vitest';
import {
  TimeCalculator,
  INITIAL_THRESHOLD_MS,
  SUBSEQUENT_THRESHOLD_MS,
  Period,
} from './timeCalculator';

const MIN = 60 * 1000;
const FULL: Period = { fromMs: -Infinity, toMs: Infinity };

describe('TimeCalculator.agentTimeMs', () => {
  it('sums a single prompt->response span', () => {
    expect(
      TimeCalculator.agentTimeMs([{ startMs: 0, endMs: 10 * MIN }], FULL),
    ).toBe(10 * MIN);
  });

  it('counts sub-agent spans additively with the parent', () => {
    const spans = [
      { startMs: 0, endMs: 10 * MIN },
      { startMs: 0, endMs: 10 * MIN },
    ];
    expect(TimeCalculator.agentTimeMs(spans, FULL)).toBe(20 * MIN);
  });

  it('counts overlapping concurrent prompts additively', () => {
    const spans = [
      { startMs: 0, endMs: 6 * MIN },
      { startMs: 3 * MIN, endMs: 9 * MIN },
    ];
    expect(TimeCalculator.agentTimeMs(spans, FULL)).toBe(12 * MIN);
  });

  it('counts cancelled/failed work through the given end timestamp', () => {
    // The reader closes an aborted span at the abort timestamp; the calculator
    // simply sums whatever span it is given.
    expect(
      TimeCalculator.agentTimeMs([{ startMs: 0, endMs: 4 * MIN }], FULL),
    ).toBe(4 * MIN);
  });
});

describe('TimeCalculator.elapsedMs', () => {
  it('clips elapsed to the report period boundaries', () => {
    const period: Period = { fromMs: 5 * MIN, toMs: 15 * MIN };
    expect(TimeCalculator.elapsedMs(0, 20 * MIN, period)).toBe(10 * MIN);
  });
});

describe('TimeCalculator.humanActivity initial interval', () => {
  const base = (gap: number) =>
    TimeCalculator.humanActivity({
      launchStartMs: 0,
      promptsMs: [gap],
      agentIntervals: [{ startMs: gap, endMs: gap + MIN }],
      period: FULL,
    });

  it('includes an initial interval <= 30m', () => {
    expect(base(25 * MIN)).toEqual({ humanMs: 25 * MIN, inactiveMs: 0 });
  });

  it('excludes an initial interval > 30m (goes to inactive)', () => {
    expect(base(31 * MIN)).toEqual({ humanMs: 0, inactiveMs: 31 * MIN });
  });

  it('includes an initial interval of exactly 30m', () => {
    expect(base(INITIAL_THRESHOLD_MS)).toEqual({
      humanMs: 30 * MIN,
      inactiveMs: 0,
    });
  });
});

describe('TimeCalculator.humanActivity subsequent interval', () => {
  // prompt0 at t=0, agent runs 0..5m (completion at 5m), prompt1 at 5m+gap.
  const scenario = (gap: number) =>
    TimeCalculator.humanActivity({
      launchStartMs: 0,
      promptsMs: [0, 5 * MIN + gap],
      agentIntervals: [
        { startMs: 0, endMs: 5 * MIN },
        { startMs: 5 * MIN + gap, endMs: 6 * MIN + gap },
      ],
      period: FULL,
    });

  it('includes a subsequent interval <= 20m', () => {
    expect(scenario(15 * MIN)).toEqual({ humanMs: 15 * MIN, inactiveMs: 0 });
  });

  it('excludes a subsequent interval > 20m', () => {
    expect(scenario(21 * MIN)).toEqual({ humanMs: 0, inactiveMs: 21 * MIN });
  });

  it('includes a subsequent interval of exactly 20m', () => {
    expect(scenario(SUBSEQUENT_THRESHOLD_MS)).toEqual({
      humanMs: 20 * MIN,
      inactiveMs: 0,
    });
  });
});

describe('TimeCalculator.humanActivity guards', () => {
  it('never counts idle time while an agent is active', () => {
    // Agent active 0..40m overlapping the whole gap before the prompt at 40m.
    const result = TimeCalculator.humanActivity({
      launchStartMs: 0,
      promptsMs: [40 * MIN],
      agentIntervals: [{ startMs: 0, endMs: 40 * MIN }],
      period: FULL,
    });
    expect(result.humanMs).toBe(0);
  });

  it('clips counted human time to the report period', () => {
    const result = TimeCalculator.humanActivity({
      launchStartMs: 0,
      promptsMs: [20 * MIN],
      agentIntervals: [{ startMs: 20 * MIN, endMs: 21 * MIN }],
      period: { fromMs: 10 * MIN, toMs: Infinity },
    });
    // Initial gap 0..20m is human (<=30m) but only 10..20m is in period.
    expect(result).toEqual({ humanMs: 10 * MIN, inactiveMs: 0 });
  });
});
