import { describe, it, expect } from 'vitest';
import { NormalizedInvocation } from '../../../session-reader';
import { GroupingService } from './groupingService';
import { Period } from './timeCalculator';

const FULL: Period = { fromMs: -Infinity, toMs: Infinity };
const MIN = 60 * 1000;

function inv(partial: Partial<NormalizedInvocation>): NormalizedInvocation {
  return {
    provider: 'codex',
    interfaceId: 'codex-cli',
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

describe('GroupingService', () => {
  it('produces one row per cwd-root for a single session', () => {
    const rows = GroupingService.build([inv({ cwd: '/home/dev/app' })], FULL);
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('/home/dev/app');
    expect(rows[0].agentTimeMs).toBe(10 * MIN);
  });

  it('absorbs descendant paths into the parent root', () => {
    const rows = GroupingService.build(
      [
        inv({ invocationId: 'L', cwd: '/home/dev/app', isRoot: true }),
        inv({
          invocationId: 'C',
          parentId: 'L',
          isRoot: false,
          cwd: '/home/dev/app/sub',
          agentSpans: [{ startMs: 2 * MIN, endMs: 5 * MIN }],
        }),
      ],
      FULL,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('/home/dev/app');
    // additive: 10m parent + 3m child
    expect(rows[0].agentTimeMs).toBe(13 * MIN);
  });

  it('splits a sub-agent in an unrelated directory into its own row', () => {
    const rows = GroupingService.build(
      [
        inv({ invocationId: 'L', cwd: '/home/dev/app', isRoot: true }),
        inv({
          invocationId: 'C',
          parentId: 'L',
          isRoot: false,
          cwd: '/home/dev/other',
          agentSpans: [{ startMs: 2 * MIN, endMs: 5 * MIN }],
        }),
      ],
      FULL,
    );
    expect(rows).toHaveLength(2);
    const paths = rows.map((r) => r.path).sort();
    expect(paths).toEqual(['/home/dev/app', '/home/dev/other']);
  });

  it('marks unknown cwd rows with a null path', () => {
    const rows = GroupingService.build([inv({ cwd: undefined })], FULL);
    expect(rows[0].path).toBeNull();
  });

  it('repeats elapsed across a launch rows but attributes human/inactive once', () => {
    const rows = GroupingService.build(
      [
        inv({
          invocationId: 'L',
          cwd: '/home/dev/app',
          isRoot: true,
          promptsMs: [0],
          agentSpans: [{ startMs: 0, endMs: 10 * MIN }],
          startMs: 0,
          endMs: 10 * MIN,
        }),
        inv({
          invocationId: 'C',
          parentId: 'L',
          isRoot: false,
          cwd: '/home/dev/other',
          agentSpans: [{ startMs: 2 * MIN, endMs: 5 * MIN }],
          startMs: 2 * MIN,
          endMs: 5 * MIN,
        }),
      ],
      FULL,
    );
    const main = rows.find((r) => r.path === '/home/dev/app')!;
    const other = rows.find((r) => r.path === '/home/dev/other')!;
    expect(main.elapsedMs).toBe(other.elapsedMs);
    expect(other.humanMs).toBe(0);
    expect(other.inactiveMs).toBe(0);
  });

  it('drops launches that do not overlap the report period', () => {
    const rows = GroupingService.build([inv({ cwd: '/x' })], {
      fromMs: 100 * MIN,
      toMs: 200 * MIN,
    });
    expect(rows).toHaveLength(0);
  });

  it('clips start/end and flags truncation at period boundaries', () => {
    const rows = GroupingService.build([inv({ cwd: '/x' })], {
      fromMs: 2 * MIN,
      toMs: 8 * MIN,
    });
    expect(rows[0].startMs).toBe(2 * MIN);
    expect(rows[0].endMs).toBe(8 * MIN);
    expect(rows[0].truncated).toBe(true);
    expect(rows[0].actualStartMs).toBe(0);
    expect(rows[0].actualEndMs).toBe(10 * MIN);
  });

  it('splits rows at temporal name boundaries and keeps launch identity', () => {
    const rows = GroupingService.build(
      [
        inv({
          launchRootId: 'Lx',
          invocationId: 'Lx',
          cwd: '/home/dev/app',
          promptsMs: [0],
          agentSpans: [{ startMs: 0, endMs: 8 * MIN }],
          startMs: 0,
          endMs: 8 * MIN,
          sessionNameEvents: [
            { timestampMs: 2 * MIN, name: 'alpha' },
            { timestampMs: 4 * MIN, name: 'beta' },
            { timestampMs: 6 * MIN, name: 'alpha' },
          ],
        }),
      ],
      FULL,
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.name)).toEqual([null, 'alpha', 'beta', 'alpha']);
    expect(rows.map((r) => r.startMs)).toEqual([0, 2 * MIN, 4 * MIN, 6 * MIN]);
    expect(rows.map((r) => r.endMs)).toEqual([2 * MIN, 4 * MIN, 6 * MIN, 8 * MIN]);
    expect(new Set(rows.map((r) => r.launchId))).toEqual(new Set(['Lx']));
  });

  it('does not create a new segment when a rename repeats the active name', () => {
    const rows = GroupingService.build(
      [
        inv({
          launchRootId: 'Ly',
          invocationId: 'Ly',
          cwd: '/home/dev/app',
          agentSpans: [{ startMs: 0, endMs: 6 * MIN }],
          startMs: 0,
          endMs: 6 * MIN,
          sessionNameEvents: [
            { timestampMs: 2 * MIN, name: 'alpha' },
            { timestampMs: 3 * MIN, name: 'alpha' },
          ],
        }),
      ],
      FULL,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual([null, 'alpha']);
    expect(rows.map((r) => r.startMs)).toEqual([0, 2 * MIN]);
  });
});
