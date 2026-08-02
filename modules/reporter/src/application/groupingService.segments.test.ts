import { describe, expect, it } from 'vitest';
import { NormalizedInvocation } from '../../../session-reader';
import { GroupingService } from './groupingService';
import { Period } from './timeCalculator';

const FULL: Period = { fromMs: -Infinity, toMs: Infinity };
const MIN = 60 * 1000;

function inv(partial: Partial<NormalizedInvocation>): NormalizedInvocation {
  return {
    provider: 'claude',
    interfaceId: 'claude-cli',
    launchRootId: 'L',
    invocationId: 'L',
    isRoot: true,
    promptsMs: [],
    agentSpans: [{ startMs: 0, endMs: 10 * MIN }],
    startMs: 0,
    endMs: 10 * MIN,
    ...partial,
  };
}

describe('GroupingService sub-agent counting with directory segments', () => {
  it('excludes working-directory segments from the sub-agent count', () => {
    const rows = GroupingService.build(
      [
        inv({ cwd: '/work/app', isSubagent: false }),
        inv({
          invocationId: 'L::cwd::1',
          parentId: 'L',
          isRoot: false,
          isSubagent: false,
          cwd: '/work/app/sub',
        }),
        inv({
          invocationId: 'L::sub::a',
          parentId: 'L',
          isRoot: false,
          isSubagent: true,
          cwd: '/work/app',
        }),
      ],
      FULL,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].subagentCount).toBe(1);
    // The descendant segment is absorbed, and all three spans stay additive.
    expect(rows[0].path).toBe('/work/app');
    expect(rows[0].agentTimeMs).toBe(30 * MIN);
  });

  it('keeps the previous meaning for readers that omit the marker', () => {
    const rows = GroupingService.build(
      [
        inv({ provider: 'codex', interfaceId: 'codex-cli', cwd: '/work/app' }),
        inv({
          provider: 'codex',
          interfaceId: 'codex-cli',
          invocationId: 'C',
          parentId: 'L',
          isRoot: false,
          cwd: '/work/app',
        }),
      ],
      FULL,
    );

    expect(rows[0].subagentCount).toBe(1);
  });

  it('gives an unrelated segment its own row without counting it', () => {
    const rows = GroupingService.build(
      [
        inv({ cwd: '/work/app', isSubagent: false }),
        inv({
          invocationId: 'L::cwd::1',
          parentId: 'L',
          isRoot: false,
          isSubagent: false,
          cwd: '/work/other',
        }),
      ],
      FULL,
    );

    expect(rows.map((r) => r.path).sort()).toEqual(['/work/app', '/work/other']);
    expect(rows.every((r) => r.subagentCount === 0)).toBe(true);
  });
});
