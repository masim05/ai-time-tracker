import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  ClaudeCliReader,
  ClaudeTranscriptRecord,
  isAgentActivity,
  isHumanPrompt,
  procStartFromStat,
} from './claudeCliReader';
import { NormalizedInvocation, ReadResult } from '../domain/models';

const FIXTURES = path.join(__dirname, '__fixtures__', 'claude');
const MIN = 60 * 1000;

const S1 = 's1-1111-1111-1111-111111111111';
const S2 = 's2-2222-2222-2222-222222222222';
const S3 = 's3-3333-3333-3333-333333333333';
const S5 = 's5-5555-5555-5555-555555555555';
const S6 = 's6-6666-6666-6666-666666666666';
const S7 = 's7-7777-7777-7777-777777777777';
const S8 = 's8-8888-8888-8888-888888888888';
const S9 = 's9-9999-9999-9999-999999999999';

/** Reads the fixture tree with a deterministic liveness probe. */
function read(options: { alivePids?: number[] } = {}): ReadResult {
  const alive = new Set(options.alivePids ?? []);
  return new ClaudeCliReader({
    baseDir: FIXTURES,
    isPidAlive: (pid) => alive.has(pid),
  }).read();
}

function launchOf(
  result: ReadResult,
  launchRootId: string,
): NormalizedInvocation[] {
  return result.invocations.filter((i) => i.launchRootId === launchRootId);
}

function segmentsOf(
  result: ReadResult,
  launchRootId: string,
): NormalizedInvocation[] {
  return launchOf(result, launchRootId).filter((i) => i.isSubagent === false);
}

function totalSpanMs(invocations: readonly NormalizedInvocation[]): number {
  return invocations
    .flatMap((i) => i.agentSpans)
    .reduce((sum, span) => sum + (span.endMs - span.startMs), 0);
}

function at(iso: string): number {
  return Date.parse(iso);
}

describe('ClaudeCliReader', () => {
  it('returns nothing when the base directory does not exist', () => {
    const result = new ClaudeCliReader({
      baseDir: path.join(FIXTURES, 'does-not-exist'),
    }).read();
    expect(result.invocations).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('normalizes a CLI launch into a claude-cli root invocation', () => {
    const [root, ...rest] = launchOf(read(), S1);
    expect(rest).toEqual([]);
    expect(root.provider).toBe('claude');
    expect(root.interfaceId).toBe('claude-cli');
    expect(root.isRoot).toBe(true);
    expect(root.isSubagent).toBe(false);
    expect(root.cwd).toBe('/work/alpha');
    expect(root.startMs).toBe(at('2026-07-15T09:00:00Z'));
    expect(root.endMs).toBe(at('2026-07-15T09:17:00Z'));
    expect(root.sessionNameEvents).toEqual([
      { timestampMs: at('2026-07-15T09:10:00Z'), name: 'alpha' },
      { timestampMs: at('2026-07-15T09:12:00Z'), name: 'beta' },
    ]);
  });

  it('extracts one session-name event per /rename record, in transcript order', () => {
    // Regression for the bug: Claude Code persists a rename as a
    // `system` / `local_command` record carrying the `/rename` invocation, and
    // nothing else in the transcript names the session.
    const [root] = launchOf(read(), S1);
    expect(root.sessionNameEvents).toEqual([
      { timestampMs: at('2026-07-15T09:10:00Z'), name: 'alpha' },
      { timestampMs: at('2026-07-15T09:12:00Z'), name: 'beta' },
    ]);
  });

  it('ignores local command records that are not a rename', () => {
    // The transcript also holds a `/compact` invocation and the
    // `<local-command-stdout>` record a rename writes after itself.
    const [root] = launchOf(read(), S1);
    const names = (root.sessionNameEvents ?? []).map((event) => event.name);
    expect(names).toEqual(['alpha', 'beta']);
  });

  it('warns without content when a rename records no name', () => {
    const result = read();
    const warnings = result.diagnostics.filter(
      (d) => d.eventType === 'session-rename',
    );
    // An empty argument at 09:13 and a whitespace-only one at 09:15.
    expect(warnings).toHaveLength(2);
    expect(warnings.map((d) => d.timestampMs)).toEqual([
      at('2026-07-15T09:13:00Z'),
      at('2026-07-15T09:15:00Z'),
    ]);
    for (const warning of warnings) {
      expect(warning.provider).toBe('claude');
      expect(warning.interfaceId).toBe('claude-cli');
      expect(warning.sessionId).toBe(S1);
      expect(warning.severity).toBe('warning');
      expect(warning.reason).toBe('rename command recorded no session name');
    }
    // The nameless renames produce no event; the named ones still do.
    const [root] = launchOf(result, S1);
    expect(root.sessionNameEvents).toHaveLength(2);
  });

  it('keeps a replayed rename with the launch that recorded it first', () => {
    // S2 resumes S1, so S1's two renames are replayed into its transcript;
    // only the rename S2 recorded itself belongs to it.
    const [resumed] = launchOf(read(), S2);
    expect(resumed.sessionNameEvents).toEqual([
      { timestampMs: at('2026-07-15T09:41:00Z'), name: 'gamma' },
    ]);
    const [original] = launchOf(read(), S1);
    expect(original.sessionNameEvents).toEqual([
      { timestampMs: at('2026-07-15T09:10:00Z'), name: 'alpha' },
      { timestampMs: at('2026-07-15T09:12:00Z'), name: 'beta' },
    ]);
  });

  it('counts only developer prompts, not injected or tool-result records', () => {
    const [root] = launchOf(read(), S1);
    expect(root.promptsMs).toEqual([
      at('2026-07-15T09:00:00Z'),
      at('2026-07-15T09:14:00Z'),
    ]);
  });

  it('spans each prompt to the last agent activity before the next prompt', () => {
    const [root] = launchOf(read(), S1);
    expect(root.agentSpans).toEqual([
      { startMs: at('2026-07-15T09:00:00Z'), endMs: at('2026-07-15T09:04:00Z') },
      { startMs: at('2026-07-15T09:14:00Z'), endMs: at('2026-07-15T09:17:00Z') },
    ]);
  });

  it('counts replayed records once, leaving a resumed launch its own work', () => {
    const resumed = launchOf(read(), S2);
    expect(resumed).toHaveLength(1);
    expect(resumed[0].promptsMs).toEqual([at('2026-07-15T09:40:00Z')]);
    expect(totalSpanMs(resumed)).toBe(5 * MIN);
    // The original launch keeps everything it recorded first.
    expect(totalSpanMs(launchOf(read(), S1))).toBe(7 * MIN);
  });

  it('drops a launch whose records were all replayed from an earlier one', () => {
    expect(launchOf(read(), S8)).toEqual([]);
  });

  it('splits a launch into one invocation per working directory', () => {
    const segments = segmentsOf(read(), S3);
    expect(segments.map((i) => i.cwd)).toEqual([
      '/work/alpha',
      '/work/alpha/tmp/wts/task',
      '/work/omega',
    ]);
    expect(segments[0].isRoot).toBe(true);
    expect(segments.slice(1).every((i) => i.parentId === S3)).toBe(true);
    expect(segments.slice(1).every((i) => i.isRoot === false)).toBe(true);
    expect(segments.map((i) => totalSpanMs([i]))).toEqual([
      2 * MIN,
      6 * MIN,
      4 * MIN,
    ]);
  });

  it('splits a response that changes directory at the boundary', () => {
    // One prompt at 09:00; the answer runs to 09:10 but moves to an unrelated
    // root at 09:06, so 6 minutes belong to the first directory and 4 to the
    // second instead of all 10 landing on the launch root.
    const segments = segmentsOf(read(), S7);
    expect(segments.map((i) => i.cwd)).toEqual(['/work/alpha', '/work/omega']);
    expect(segments[0].agentSpans).toEqual([
      { startMs: at('2026-07-20T09:00:00Z'), endMs: at('2026-07-20T09:06:00Z') },
    ]);
    expect(segments[1].agentSpans).toEqual([
      { startMs: at('2026-07-20T09:06:00Z'), endMs: at('2026-07-20T09:10:00Z') },
    ]);
    // No span may run past the end of the invocation that owns it.
    for (const segment of segments) {
      for (const span of segment.agentSpans) {
        expect(span.endMs).toBeLessThanOrEqual(segment.endMs ?? Infinity);
      }
    }
  });

  it('keeps metadata records without a cwd in the current segment', () => {
    const segments = segmentsOf(read(), S3);
    // The transcript contains a file-history-delta record with no cwd between
    // the first and second directory; it must not open an `unknown` segment.
    expect(segments).toHaveLength(3);
    expect(segments.every((i) => i.cwd !== undefined)).toBe(true);
  });

  it('emits one additive invocation per sub-agent transcript', () => {
    const subagents = launchOf(read(), S3).filter((i) => i.isSubagent === true);
    expect(subagents).toHaveLength(2);
    for (const sub of subagents) {
      expect(sub.isRoot).toBe(false);
      expect(sub.parentId).toBe(S3);
      expect(sub.promptsMs).toEqual([]);
      expect(sub.interfaceId).toBe('claude-cli');
    }
    expect(subagents.map((i) => i.cwd).sort()).toEqual([
      '/work/alpha/tmp/wts/task',
      '/work/omega',
    ]);
    // 4 min overlapping the parent + 2 min in the unrelated directory.
    expect(totalSpanMs(subagents)).toBe(6 * MIN);
  });

  it('skips embedded Agent SDK sessions and reports the count once', () => {
    const result = read();
    expect(result.invocations.some((i) => i.launchRootId.startsWith('s4-'))).toBe(
      false,
    );
    const skipped = result.diagnostics.filter((d) =>
      d.reason.includes('embedded Agent SDK'),
    );
    expect(skipped).toHaveLength(1);
    expect(skipped[0].severity).toBe('warning');
    expect(skipped[0].reason).toContain('1 session(s) skipped');
  });

  it('reports a transcript without an entrypoint separately from SDK sessions', () => {
    const result = read();
    expect(launchOf(result, S9)).toEqual([]);
    const skipped = result.diagnostics.filter((d) =>
      d.reason.includes('no entrypoint recorded'),
    );
    expect(skipped).toHaveLength(1);
    expect(skipped[0].severity).toBe('warning');
    expect(skipped[0].reason).not.toContain('Agent SDK');
  });

  it('reports a malformed line as an error and keeps the valid records', () => {
    const result = read();
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].sessionId).toBe(S5);
    expect(errors[0].eventType).toBe('jsonl-line');
    expect(errors[0].reason).toBe('malformed JSON at line 2');
    expect(totalSpanMs(launchOf(result, S5))).toBe(3 * MIN);
  });

  it('marks a launch active only while its registered process is alive', () => {
    const active = launchOf(read({ alivePids: [4242] }), S6);
    expect(active).toHaveLength(1);
    expect(active[0].endMs).toBeNull();

    const finished = launchOf(read(), S6);
    expect(finished[0].endMs).toBe(at('2026-07-19T09:04:00Z'));
  });

  it('leaves only the last segment open for an active multi-segment launch', () => {
    // S3 is registered live under pid 5151 and has three directory segments.
    const segments = segmentsOf(read({ alivePids: [5151] }), S3);
    expect(segments).toHaveLength(3);
    expect(segments.slice(0, -1).every((i) => i.endMs !== null)).toBe(true);
    expect(segments[segments.length - 1].endMs).toBeNull();

    const closed = segmentsOf(read(), S3);
    expect(closed.every((i) => i.endMs !== null)).toBe(true);
  });

  it('does not let a stale registry entry mask a live one', () => {
    // S3 is named by three registry files: a live one (5151) with a stale file
    // on either side of it in name order (1150, 9150), so a stale entry is read
    // after the live one under both ascending and descending order and keeping
    // only one entry per session would report the running launch as finished.
    expect(segmentsOf(read({ alivePids: [5151] }), S3).at(-1)?.endMs).toBeNull();
    // With neither process alive the launch is finished.
    expect(segmentsOf(read(), S3).at(-1)?.endMs).not.toBeNull();
  });

  it('never puts record content into diagnostics', () => {
    const allowed = new Set([
      'provider',
      'interfaceId',
      'sessionId',
      'filePath',
      'eventType',
      'timestampMs',
      'reason',
      'severity',
    ]);
    const diagnostics = read().diagnostics;
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of diagnostics) {
      expect(Object.keys(diagnostic).every((k) => allowed.has(k))).toBe(true);
    }
  });
});

describe('isHumanPrompt', () => {
  const base: ClaudeTranscriptRecord = {
    type: 'user',
    timestamp: '2026-07-15T09:00:00Z',
  };

  it.each<[string, ClaudeTranscriptRecord, boolean]>([
    ['typed prompt', { ...base, promptSource: 'typed' }, true],
    ['queued prompt', { ...base, promptSource: 'queued' }, true],
    ['accepted suggestion', { ...base, promptSource: 'suggestion_accepted' }, true],
    ['no promptSource recorded', { ...base }, true],
    ['system-injected notification', { ...base, promptSource: 'system' }, false],
    ['programmatic SDK prompt', { ...base, promptSource: 'sdk' }, false],
    ['meta record', { ...base, promptSource: 'typed', isMeta: true }, false],
    ['sidechain record', { ...base, promptSource: 'typed', isSidechain: true }, false],
    ['tool result', { ...base, toolUseResult: { ok: true } }, false],
    ['tool-sourced record', { ...base, sourceToolAssistantUUID: 'a1' }, false],
    ['tool-use-sourced record', { ...base, sourceToolUseID: 'toolu_1' }, false],
    ['assistant record', { ...base, type: 'assistant' }, false],
  ])('classifies %s', (_name, record, expected) => {
    expect(isHumanPrompt(record)).toBe(expected);
  });
});

describe('isAgentActivity', () => {
  it('counts assistant records and tool results only', () => {
    expect(isAgentActivity({ type: 'assistant' })).toBe(true);
    expect(isAgentActivity({ type: 'user', toolUseResult: { ok: true } })).toBe(
      true,
    );
    expect(isAgentActivity({ type: 'user', promptSource: 'typed' })).toBe(false);
    expect(isAgentActivity({ type: 'file-history-delta' })).toBe(false);
  });
});

describe('procStartFromStat', () => {
  /** Builds a `/proc/<pid>/stat` line with the given comm and starttime. */
  function statLine(comm: string, startTime: string): string {
    const before = ['1234', `(${comm})`, 'S'];
    // Fields 4..21 (18 values) precede starttime, which is field 22.
    const filler = Array.from({ length: 18 }, (_, i) => String(i));
    return `${before.join(' ')} ${filler.join(' ')} ${startTime} rest of line\n`;
  }

  it('reads field 22 for a simple process name', () => {
    expect(procStartFromStat(statLine('node', '585274575'))).toBe('585274575');
  });

  it('reads field 22 when the process name contains spaces and parentheses', () => {
    expect(procStartFromStat(statLine('weird (name) x', '42'))).toBe('42');
  });

  it('returns undefined for a malformed line', () => {
    expect(procStartFromStat('not a stat line')).toBeUndefined();
    expect(procStartFromStat('1234 (node) S 1 2 3')).toBeUndefined();
  });
});
