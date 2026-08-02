import { describe, it, expect, beforeAll } from 'vitest';
import {
  formatDuration,
  durationToMinutes,
  formatLocalTimestamp,
  formatIsoWithOffset,
  substituteHome,
} from './formatUtils';

beforeAll(() => {
  process.env.TZ = 'UTC';
});

const MIN = 60 * 1000;

describe('formatDuration', () => {
  it('formats zero and minute-only durations', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(3 * MIN)).toBe('3m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(10 * 60 * MIN + 3 * MIN)).toBe('10h3m');
  });

  it('formats days, hours and minutes', () => {
    expect(formatDuration((2 * 24 * 60 + 10 * 60 + 3) * MIN)).toBe('2d10h3m');
  });

  it('rounds to the nearest minute', () => {
    expect(durationToMinutes(89 * 1000)).toBe(1);
    expect(durationToMinutes(91 * 1000)).toBe(2);
  });
});

describe('timestamp formatting (TZ=UTC)', () => {
  const ms = Date.UTC(2026, 7, 1, 17, 1, 46);

  it('formats a local timestamp', () => {
    expect(formatLocalTimestamp(ms)).toBe('2026-08-01 17:01');
  });

  it('formats ISO 8601 with UTC offset', () => {
    expect(formatIsoWithOffset(ms)).toBe('2026-08-01T17:01:46+00:00');
  });
});

describe('substituteHome', () => {
  it('replaces the home prefix with ~', () => {
    expect(substituteHome('/home/dev/app', '/home/dev')).toBe('~/app');
    expect(substituteHome('/home/dev', '/home/dev')).toBe('~');
    expect(substituteHome('/other/app', '/home/dev')).toBe('/other/app');
  });
});
