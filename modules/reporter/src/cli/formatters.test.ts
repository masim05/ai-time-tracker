import { describe, it, expect, beforeAll } from 'vitest';
import { ColumnProjector } from '../application/columnProjector';
import { ReportRow } from '../domain/reportRow';
import { ColumnId } from '../domain/column';
import { TableFormatter } from './tableFormatter';
import { JsonFormatter } from './jsonFormatter';
import { CsvFormatter } from './csvFormatter';

beforeAll(() => {
  process.env.TZ = 'UTC';
});

const MIN = 60 * 1000;

function row(partial: Partial<ReportRow>): ReportRow {
  return {
    launchId: 'launch-one',
    launchShort: 'abc123',
    agent: 'codex-cli',
    path: '/home/dev/app',
    humanMs: 3 * MIN,
    agentTimeMs: 10 * 60 * MIN + 3 * MIN,
    elapsedMs: 5 * MIN,
    inactiveMs: 0,
    startMs: Date.UTC(2026, 7, 1, 17, 1, 46),
    endMs: Date.UTC(2026, 7, 1, 17, 6, 46),
    actualStartMs: Date.UTC(2026, 7, 1, 17, 1, 46),
    actualEndMs: Date.UTC(2026, 7, 1, 17, 6, 46),
    truncated: false,
    active: false,
    subagentCount: 0,
    ...partial,
  };
}

const DEFAULT_IDS: ColumnId[] = [
  'launch',
  'agent',
  'path',
  'human',
  'agent-time',
  'elapsed',
  'start',
  'duration',
  'subagents',
];

describe('TableFormatter', () => {
  it('renders aligned columns with ~ home substitution and durations', () => {
    const report = ColumnProjector.project([row({})], DEFAULT_IDS);
    const out = new TableFormatter({ homeDir: '/home/dev' }).format(report);
    const lines = out.split('\n');
    expect(lines[0]).toContain('launch');
    expect(lines[0]).toContain('agent-time');
    expect(lines[1]).toContain('~/app');
    expect(lines[1]).toContain('10h3m');
    expect(lines[1]).toContain('2026-08-01 17:01:46');
    // header/value columns aligned to the same width
    expect(lines[0].indexOf('agent')).toBeGreaterThanOrEqual(0);
    // separator and total row appended
    expect(lines[2]).toMatch(/^-+/);
    expect(lines[3]).toContain('total');
    expect(lines[3]).toContain('10h3m'); // agent-time sum (additive)
  });

  it('renders unknown for null paths and empty for active end', () => {
    const report = ColumnProjector.project(
      [row({ path: null, endMs: null, active: true })],
      DEFAULT_IDS,
    );
    const out = new TableFormatter().format(report);
    expect(out).toContain('unknown');
  });

  it('omits separator and total row when there are no data rows', () => {
    const report = ColumnProjector.project([], DEFAULT_IDS);
    const out = new TableFormatter().format(report);
    const lines = out.split('\n');
    expect(lines).toHaveLength(1); // header only
    expect(lines[0]).toContain('launch');
  });

  it('sums only additive columns in the total row; non-additive stay empty', () => {
    const report = ColumnProjector.project(
      [row({ humanMs: 2 * MIN, subagentCount: 3 }), row({ humanMs: 4 * MIN, subagentCount: 7 })],
      ['launch', 'human', 'subagents'],
    );
    const out = new TableFormatter().format(report);
    const lines = out.split('\n');
    // header, 2 data rows, separator, total
    expect(lines).toHaveLength(5);
    const totalLine = lines[4];
    expect(totalLine).toContain('total');
    expect(totalLine).toContain('6m'); // human is additive: 2+4 minutes
    // subagents is non-additive: '3', '7', '10' must not appear in total row
    expect(totalLine).not.toMatch(/\b(3|7|10)\b/);
  });
});

describe('JsonFormatter', () => {
  it('emits objects with integer-minute durations and ISO timestamps', () => {
    const report = ColumnProjector.project([row({})], DEFAULT_IDS);
    const parsed = JSON.parse(new JsonFormatter().format(report));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]['agent-time']).toBe(603);
    expect(parsed[0].start).toBe('2026-08-01T17:01:46+00:00');
    expect(parsed[0].path).toBe('/home/dev/app');
  });

  it('emits [] for an empty result', () => {
    const report = ColumnProjector.project([], DEFAULT_IDS);
    expect(new JsonFormatter().format(report)).toBe('[]');
  });

  it('emits null for an active session end', () => {
    const report = ColumnProjector.project(
      [row({ endMs: null, actualEndMs: null, active: true })],
      ['launch', 'end', 'actual-end'],
    );
    const parsed = JSON.parse(new JsonFormatter().format(report));
    expect(parsed[0].end).toBeNull();
    expect(parsed[0]['actual-end']).toBeNull();
  });
});

describe('CsvFormatter', () => {
  it('emits a header plus rows with the same conventions', () => {
    const report = ColumnProjector.project([row({})], DEFAULT_IDS);
    const lines = new CsvFormatter().format(report).split('\n');
    expect(lines[0]).toBe('launch,agent,path,human,agent-time,elapsed,start,duration,subagents');
    expect(lines[1]).toContain('603');
    expect(lines[1]).toContain('2026-08-01T17:01:46+00:00');
  });

  it('emits the header only for an empty result', () => {
    const report = ColumnProjector.project([], DEFAULT_IDS);
    expect(new CsvFormatter().format(report)).toBe(
      'launch,agent,path,human,agent-time,elapsed,start,duration,subagents',
    );
  });

  it('emits an empty field for an active session end', () => {
    const report = ColumnProjector.project(
      [row({ endMs: null, active: true })],
      ['launch', 'end'],
    );
    const lines = new CsvFormatter().format(report).split('\n');
    expect(lines[1]).toBe('abc123,');
  });
});
