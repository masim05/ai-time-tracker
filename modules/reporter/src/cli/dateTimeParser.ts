import { UsageError } from '../application/errors';

/** Returns the timezone offset (minutes, like `Date#getTimezoneOffset`). */
export type OffsetResolver = (utcMs: number) => number;

const DEFAULT_OFFSET: OffsetResolver = (utcMs) =>
  new Date(utcMs).getTimezoneOffset();

const DAY_MS = 24 * 60 * 60 * 1000;

interface Components {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Parses the accepted datetime formats into epoch milliseconds.
 *
 * Accepts ISO 8601 (with explicit offset/`Z`), `YYYYMMDD[-HHmm[ss]]`,
 * `YYYY-MM-DD[-HHmm[ss]]`, and ISO local (`YYYY-MM-DDTHH:MM[:SS]`). A missing
 * time defaults to `00:00:00`; a missing timezone uses machine-local time. A
 * local wall-clock time that is ambiguous or non-existent due to a DST
 * transition is rejected unless an explicit offset is supplied.
 */
export const DateTimeParser = {
  parse(input: string, offsetAt: OffsetResolver = DEFAULT_OFFSET): number {
    const value = input.trim();
    if (value.length === 0) {
      throw new UsageError('Empty datetime value.');
    }

    // Explicit timezone (offset or Z) on an ISO datetime => native parsing.
    if (/T/.test(value) && /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) {
        throw new UsageError(`Invalid datetime: '${input}'.`);
      }
      return ms;
    }

    const components = extractComponents(value);
    if (!components) {
      throw new UsageError(`Invalid datetime: '${input}'.`);
    }
    validateRanges(components, input);

    const wallMs = Date.UTC(
      components.year,
      components.month - 1,
      components.day,
      components.hour,
      components.minute,
      components.second,
    );
    const instants = resolveLocal(wallMs, offsetAt);
    if (instants.length === 0) {
      throw new UsageError(
        `Datetime '${input}' does not exist due to a DST transition; supply an explicit offset.`,
      );
    }
    if (instants.length > 1) {
      throw new UsageError(
        `Datetime '${input}' is ambiguous due to a DST transition; supply an explicit offset.`,
      );
    }
    return instants[0];
  },
};

function extractComponents(value: string): Components | null {
  const patterns: { re: RegExp; map: (m: RegExpMatchArray) => Components }[] = [
    {
      re: /^(\d{4})(\d{2})(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3]),
    },
    {
      re: /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3], m[4], m[5]),
    },
    {
      re: /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3], m[4], m[5], m[6]),
    },
    {
      re: /^(\d{4})-(\d{2})-(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3]),
    },
    {
      re: /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3], m[4], m[5]),
    },
    {
      re: /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/,
      map: (m) => comp(m[1], m[2], m[3], m[4], m[5], m[6]),
    },
    {
      re: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
      map: (m) => comp(m[1], m[2], m[3], m[4], m[5], m[6]),
    },
  ];
  for (const { re, map } of patterns) {
    const match = value.match(re);
    if (match) {
      return map(match);
    }
  }
  return null;
}

function comp(
  year: string,
  month: string,
  day: string,
  hour = '0',
  minute = '0',
  second = '0',
): Components {
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function validateRanges(c: Components, input: string): void {
  const ok =
    c.month >= 1 &&
    c.month <= 12 &&
    c.day >= 1 &&
    c.day <= 31 &&
    c.hour <= 23 &&
    c.minute <= 59 &&
    c.second <= 59;
  if (!ok) {
    throw new UsageError(`Invalid datetime: '${input}'.`);
  }
}

/**
 * Resolves a local wall-clock time (expressed as a UTC-epoch of the same
 * components) to the set of matching UTC instants, using the offset resolver.
 * Returns 0 instants for a non-existent time, 1 for a normal time, and 2 for an
 * ambiguous time.
 */
function resolveLocal(wallMs: number, offsetAt: OffsetResolver): number[] {
  const candidates = new Set<number>([
    offsetAt(wallMs - DAY_MS),
    offsetAt(wallMs),
    offsetAt(wallMs + DAY_MS),
  ]);
  const instants = new Set<number>();
  for (const off of candidates) {
    const t = wallMs + off * 60_000;
    if (offsetAt(t) === off) {
      instants.add(t);
    }
  }
  return [...instants];
}
