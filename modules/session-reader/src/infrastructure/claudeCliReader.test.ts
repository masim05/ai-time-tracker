import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { ClaudeCliReader } from './claudeCliReader';
import { NormalizedInvocation, ReadResult } from '../domain/models';

const FIXTURES = path.join(__dirname, '__fixtures__', 'claude');
const MIN = 60 * 1000;

const S1 = 's1-1111-1111-1111-111111111111';
const S2 = 's2-2222-2222-2222-222222222222';
const S3 = 's3-3333-3333-3333-333333333333';
const S5 = 's5-5555-5555-5555-555555555555';
const S6 = 's6-6666-6666-6666-666666666666';

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

  it('splits a launch into one invocation per working directory', () => {
    const segments = launchOf(read(), S3).filter((i) => i.isSubagent === false);
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

  it('keeps metadata records without a cwd in the current segment', () => {
    const segments = launchOf(read(), S3).filter((i) => i.isSubagent === false);
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

  it('leaves earlier segments closed when only the last one is active', () => {
    // S3 has three segments; none is registered as live, so all are closed.
    const segments = launchOf(read({ alivePids: [4242] }), S3);
    expect(segments.every((i) => i.endMs !== null)).toBe(true);
  });

  it('never puts record content into diagnostics', () => {
    for (const diagnostic of read().diagnostics) {
      const serialized = JSON.stringify(diagnostic);
      expect(serialized).not.toContain('role');
      expect(serialized).not.toContain('message');
    }
  });
});
