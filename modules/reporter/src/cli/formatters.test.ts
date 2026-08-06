import { describe, it, expect, beforeAll } from 'vitest';
import { ColumnProjector } from '../application/columnProjector';
import { ReportRow } from '../domain/reportRow';
import { ColumnId } from '../domain/column';
import { TableFormatter } from './tableFormatter';
import { JsonFormatter } from './jsonFormatter';
import { CsvFormatter } from './csvFormatter';
import { terminalWidth } from './terminalWidth';

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
    name: null,
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
    segmentStartMs: Date.UTC(2026, 7, 1, 17, 1, 46),
    ...partial,
  };
}

const DEFAULT_IDS: ColumnId[] = [
  'agent',
  'path',
  'name',
  'human',
  'agent-time',
  'start',
  'duration',
  'subagents',
];

describe('TableFormatter', () => {
  it('renders aligned columns with ~ home substitution and durations', () => {
    const report = ColumnProjector.project([row({})], DEFAULT_IDS);
    const out = new TableFormatter({ homeDir: '/home/dev' }).format(report);
    const lines = out.split('\n');
    expect(lines[0]).toContain('agent');
    expect(lines[0]).toContain('agent-time');
    expect(lines[1]).toContain('app');
    expect(lines[1]).toContain('-');
    expect(lines[1]).toContain('10h3m');
    expect(lines[1]).toContain('2026-08-01 17:01');
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
    expect(lines[0]).toContain('agent');
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

  it('truncates session names to 16 characters with an ellipsis', () => {
    const report = ColumnProjector.project(
      [row({ name: 'authentication-refactor' })],
      ['name'],
    );
    const out = new TableFormatter().format(report);
    expect(out.split('\n')[1]).toBe('authentication-…');
    expect(Array.from(out.split('\n')[1])).toHaveLength(16);
  });

  it('does not truncate session names at or below 16 characters', () => {
    const report = ColumnProjector.project(
      [row({ name: '1234567890abcdef' })],
      ['name'],
    );
    const out = new TableFormatter().format(report);
    expect(out.split('\n')[1]).toBe('1234567890abcdef');
  });

  it.each([
    ['combining characters', 'e\u0301'.repeat(17), 'e\u0301'.repeat(15) + '…'],
    ['wide CJK characters', '会'.repeat(9), '会'.repeat(7) + '…'],
    ['joined emoji', '👩‍💻'.repeat(9), '👩‍💻'.repeat(7) + '…'],
  ])('truncates %s at grapheme boundaries within 16 display cells', (_case, name, expected) => {
    const report = ColumnProjector.project([row({ name })], ['name']);
    const rendered = new TableFormatter().format(report).split('\n')[1];
    expect(rendered).toBe(expected);
    expect(terminalWidth(rendered)).toBeLessThanOrEqual(16);
  });

  it('keeps an exact 16-cell wide name unchanged', () => {
    const name = '会'.repeat(8);
    const report = ColumnProjector.project([row({ name })], ['name']);
    expect(new TableFormatter().format(report).split('\n')[1]).toBe(name);
  });

  it('aligns following columns by terminal display width', () => {
    const report = ColumnProjector.project(
      [row({ name: '会話' }), row({ name: 'plain' })],
      ['name', 'agent'],
    );
    const lines = new TableFormatter().format(report).split('\n');
    const agentOffsets = lines.slice(0, 3).map((line) =>
      terminalWidth(line.slice(0, line.lastIndexOf('codex-cli') >= 0 ? line.lastIndexOf('codex-cli') : line.lastIndexOf('agent'))),
    );
    expect(new Set(agentOffsets).size).toBe(1);
  });

  it('counts keycap emoji as two terminal display cells', () => {
    expect(terminalWidth('1️⃣')).toBe(2);
  });

  it('truncates keycap emoji within 16 display cells', () => {
    const report = ColumnProjector.project(
      [row({ name: '1️⃣'.repeat(9) })],
      ['name'],
    );
    const rendered = new TableFormatter().format(report).split('\n')[1];
    expect(rendered).toBe('1️⃣'.repeat(7) + '…');
    expect(terminalWidth(rendered)).toBe(15);
  });

  it('aligns a following column after keycap emoji', () => {
    const report = ColumnProjector.project(
      [row({ name: '1️⃣'.repeat(4) }), row({ name: 'plain' })],
      ['name', 'agent'],
    );
    expectFollowingAgentColumnsToAlign(new TableFormatter().format(report));
  });

  it.each([
    ['newline', 'safe\nforged', 'safe�forged'],
    ['ANSI escape', 'safe\u001b[31mred', 'safe�[31mred'],
    ['tab and delete', 'safe\tname\u007f', 'safe�name�'],
  ])('sanitizes %s in table names', (_case, name, expected) => {
    const report = ColumnProjector.project([row({ name })], ['name']);
    const lines = new TableFormatter().format(report).split('\n');
    expect(lines[1]).toBe(expected);
    expect(lines).toHaveLength(4);
  });

  it('keeps columns aligned after sanitizing name controls', () => {
    const report = ColumnProjector.project(
      [row({ name: 'safe\nforged' }), row({ name: '\u001b[31mred' })],
      ['name', 'agent'],
    );
    expectFollowingAgentColumnsToAlign(new TableFormatter().format(report));
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

  it('preserves the full session name', () => {
    const report = ColumnProjector.project(
      [row({ name: 'authentication-refactor' })],
      ['name'],
    );
    const parsed = JSON.parse(new JsonFormatter().format(report));
    expect(parsed[0].name).toBe('authentication-refactor');
  });

  it('preserves a full Unicode session name', () => {
    const name = '👩‍💻-e\u0301-会話'.repeat(4);
    const report = ColumnProjector.project([row({ name })], ['name']);
    expect(JSON.parse(new JsonFormatter().format(report))[0].name).toBe(name);
  });

  it('preserves control characters in a session name', () => {
    const name = 'line\nansi\u001b[31m\tend';
    const report = ColumnProjector.project([row({ name })], ['name']);
    expect(JSON.parse(new JsonFormatter().format(report))[0].name).toBe(name);
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
    expect(lines[0]).toBe('agent,path,name,human,agent-time,start,duration,subagents');
    expect(lines[1]).toContain('603');
    expect(lines[1]).toContain('2026-08-01T17:01:46+00:00');
  });

  it('emits the header only for an empty result', () => {
    const report = ColumnProjector.project([], DEFAULT_IDS);
    expect(new CsvFormatter().format(report)).toBe(
      'agent,path,name,human,agent-time,start,duration,subagents',
    );
  });

  it('shows ~ when path equals the home directory', () => {
    const report = ColumnProjector.project(
      [row({ path: '/home/dev' })],
      ['path'],
    );
    const out = new TableFormatter({ homeDir: '/home/dev' }).format(report);
    expect(out.split('\n')[1]).toContain('~');
  });

  it('emits an empty field for an active session end', () => {
    const report = ColumnProjector.project(
      [row({ endMs: null, active: true })],
      ['launch', 'end'],
    );
    const lines = new CsvFormatter().format(report).split('\n');
    expect(lines[1]).toBe('abc123,');
  });

  it('preserves the full session name', () => {
    const report = ColumnProjector.project(
      [row({ name: 'authentication-refactor' })],
      ['name'],
    );
    const lines = new CsvFormatter().format(report).split('\n');
    expect(lines[1]).toBe('authentication-refactor');
  });

  it('preserves a full Unicode session name', () => {
    const name = '👩‍💻-e\u0301-会話'.repeat(4);
    const report = ColumnProjector.project([row({ name })], ['name']);
    expect(new CsvFormatter().format(report).split('\n')[1]).toBe(name);
  });

  it('preserves control characters in a quoted CSV session name', () => {
    const name = 'line\nansi\u001b[31m\tend';
    const report = ColumnProjector.project([row({ name })], ['name']);
    expect(new CsvFormatter().format(report)).toBe(`name\n"${name}"`);
  });
});

function expectFollowingAgentColumnsToAlign(output: string): void {
  const offsets = output.split('\n').slice(0, 3).map((line) => {
    const marker = line.includes('codex-cli') ? 'codex-cli' : 'agent';
    return terminalWidth(line.slice(0, line.lastIndexOf(marker)));
  });
  expect(new Set(offsets).size).toBe(1);
}
