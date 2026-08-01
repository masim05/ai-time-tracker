import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { CopilotCliReader, parseWorkspaceCwd } from './copilotCliReader';
import { NormalizedInvocation } from '../domain/models';

const FIXTURE_BASE = path.join(__dirname, '__fixtures__', 'copilot');
const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

function iso(s: string): number {
  return Date.parse(s);
}

function read() {
  return new CopilotCliReader({ baseDir: FIXTURE_BASE }).read();
}

describe('parseWorkspaceCwd', () => {
  it('extracts cwd from a flat workspace.yaml', () => {
    expect(parseWorkspaceCwd('id: x\ncwd: /home/dev/app\nfoo: bar\n')).toBe(
      '/home/dev/app',
    );
  });

  it('returns undefined when cwd is absent', () => {
    expect(parseWorkspaceCwd('id: x\n')).toBeUndefined();
  });
});

describe('CopilotCliReader', () => {
  it('parses the root session, prompts, and working directory', () => {
    const { invocations } = read();
    const root = invocations.find(
      (i) => i.invocationId === S1 && i.isRoot,
    ) as NormalizedInvocation;
    expect(root).toBeDefined();
    expect(root.interfaceId).toBe('copilot-cli');
    expect(root.cwd).toBe('/home/dev/app');
    // Only the human prompt counts; the parentAgentTaskId prompt is excluded.
    expect(root.promptsMs).toEqual([iso('2026-08-01T10:01:00.000Z')]);
  });

  it('counts main-agent turns, including an aborted turn through the abort ts', () => {
    const { invocations } = read();
    const root = invocations.find(
      (i) => i.invocationId === S1 && i.isRoot,
    ) as NormalizedInvocation;
    const spans = [...root.agentSpans].sort((a, b) => a.startMs - b.startMs);
    expect(spans).toContainEqual({
      startMs: iso('2026-08-01T10:01:01.000Z'),
      endMs: iso('2026-08-01T10:03:00.000Z'),
    });
    // Aborted turn tn2 closed at the abort timestamp.
    expect(spans).toContainEqual({
      startMs: iso('2026-08-01T10:07:00.000Z'),
      endMs: iso('2026-08-01T10:07:30.000Z'),
    });
  });

  it('reconstructs the sub-agent invocation with a parent link', () => {
    const { invocations } = read();
    const sub = invocations.find(
      (i) => i.launchRootId === S1 && !i.isRoot,
    ) as NormalizedInvocation;
    expect(sub).toBeDefined();
    expect(sub.parentId).toBe(S1);
    expect(sub.agentSpans).toEqual([
      {
        startMs: iso('2026-08-01T10:04:00.000Z'),
        endMs: iso('2026-08-01T10:06:00.000Z'),
      },
    ]);
  });

  it('produces a partial result and an error diagnostic for a malformed line', () => {
    const { invocations, diagnostics } = read();
    // The valid session in the corrupt file still parses.
    const s2 = invocations.find((i) => i.invocationId === S2);
    expect(s2).toBeDefined();
    const err = diagnostics.find(
      (d) => d.sessionId === S2 && d.severity === 'error',
    );
    expect(err).toBeDefined();
    // Diagnostics never carry session content.
    expect(err?.reason).not.toContain('this-is-not-json');
  });

  it('returns nothing when there is no session-state directory', () => {
    const result = new CopilotCliReader({ baseDir: '/nonexistent/copilot' }).read();
    expect(result.invocations).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(0);
  });
});
