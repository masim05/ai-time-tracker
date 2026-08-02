import { describe, it, expect } from 'vitest';
import { DateTimeParser, OffsetResolver } from './dateTimeParser';
import { UsageError } from '../application/errors';

// UTC offset resolver (no DST) — deterministic regardless of host timezone.
const UTC: OffsetResolver = () => 0;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

describe('DateTimeParser accepted formats (UTC host)', () => {
  it('parses YYYYMMDD as local midnight', () => {
    expect(iso(DateTimeParser.parse('20260801', UTC))).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('parses YYYYMMDD-HHmm', () => {
    expect(iso(DateTimeParser.parse('20260801-1705', UTC))).toBe(
      '2026-08-01T17:05:00.000Z',
    );
  });

  it('parses YYYYMMDD-HHmmss', () => {
    expect(iso(DateTimeParser.parse('20260801-170501', UTC))).toBe(
      '2026-08-01T17:05:01.000Z',
    );
  });

  it('parses YYYY-MM-DD', () => {
    expect(iso(DateTimeParser.parse('2026-08-01', UTC))).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('parses YYYY-MM-DD-HHmm', () => {
    expect(iso(DateTimeParser.parse('2026-08-01-1705', UTC))).toBe(
      '2026-08-01T17:05:00.000Z',
    );
  });

  it('parses YYYY-MM-DD-HHmmss', () => {
    expect(iso(DateTimeParser.parse('2026-08-01-170501', UTC))).toBe(
      '2026-08-01T17:05:01.000Z',
    );
  });

  it('parses ISO 8601 local (no offset) as machine-local time', () => {
    expect(iso(DateTimeParser.parse('2026-08-01T17:05:01', UTC))).toBe(
      '2026-08-01T17:05:01.000Z',
    );
  });
});

describe('DateTimeParser timezone handling', () => {
  it('honors an explicit UTC offset', () => {
    expect(iso(DateTimeParser.parse('2026-08-01T17:05:01+03:00'))).toBe(
      '2026-08-01T14:05:01.000Z',
    );
  });

  it('honors a trailing Z', () => {
    expect(iso(DateTimeParser.parse('2026-08-01T17:05:01Z'))).toBe(
      '2026-08-01T17:05:01.000Z',
    );
  });

  it('defaults a missing time to 00:00:00', () => {
    expect(iso(DateTimeParser.parse('2026-08-01', UTC))).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
});

describe('DateTimeParser DST handling', () => {
  // Models US Eastern around the 2021-11-07 fall-back transition (06:00Z).
  // Before the transition EDT = UTC-4 (offset +240); after EST = UTC-5 (+300).
  const eastern: OffsetResolver = (utcMs) =>
    utcMs < Date.UTC(2021, 10, 7, 6, 0, 0) ? 240 : 300;

  it('rejects an ambiguous local time without an offset', () => {
    // 01:30 local occurs twice on the fall-back day.
    expect(() => DateTimeParser.parse('2021-11-07-0130', eastern)).toThrow(
      UsageError,
    );
  });

  it('accepts an unambiguous local time', () => {
    expect(() =>
      DateTimeParser.parse('2021-11-07-0400', eastern),
    ).not.toThrow();
  });
});

describe('DateTimeParser errors', () => {
  it('rejects invalid values', () => {
    expect(() => DateTimeParser.parse('not-a-date', UTC)).toThrow(UsageError);
    expect(() => DateTimeParser.parse('2026-13-01', UTC)).toThrow(UsageError);
  });
});
