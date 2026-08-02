import {
  NormalizedInvocation,
  WorkInterval,
} from '../../../session-reader';
import { ReportRow } from '../domain/reportRow';
import { isUnderOrEqual, normalizePath } from '../domain/pathUtils';
import { Period, TimeCalculator } from './timeCalculator';

const UNKNOWN = '\u0000unknown';

/**
 * Groups normalized invocations into report rows.
 *
 * Row identity is `launch × agent (interface) × effective working-directory
 * root`. Descendants whose working directory is under their effective parent
 * root are absorbed into that root; a sub-agent in an unrelated directory
 * starts its own row. Human-active, inactive, elapsed, and launch boundaries
 * are launch-level values attributed to the main root's row and repeated
 * (non-additively) onto other rows of the same launch.
 */
export const GroupingService = {
  build(
    invocations: readonly NormalizedInvocation[],
    period: Period,
  ): ReportRow[] {
    const byLaunch = new Map<string, NormalizedInvocation[]>();
    for (const inv of invocations) {
      const list = byLaunch.get(inv.launchRootId) ?? [];
      list.push(inv);
      byLaunch.set(inv.launchRootId, list);
    }

    const rows: ReportRow[] = [];
    for (const [launchId, invs] of byLaunch.entries()) {
      const built = buildLaunchRows(launchId, invs, period);
      rows.push(...built);
    }
    return rows;
  },
};

function buildLaunchRows(
  launchId: string,
  invs: readonly NormalizedInvocation[],
  period: Period,
): ReportRow[] {
  const byId = new Map(invs.map((i) => [i.invocationId, i]));
  const root = invs.find((i) => i.isRoot) ?? invs[0];

  // Launch-level actual boundaries.
  const actualStartMs = Math.min(...invs.map((i) => i.startMs));
  const active = invs.some((i) => i.endMs === null);
  const actualEndMs = active
    ? null
    : Math.max(...invs.map((i) => i.endMs ?? i.startMs));

  // Drop launches with no overlap with the period.
  const finalEndForElapsed = active ? period.toMs : (actualEndMs as number);
  if (finalEndForElapsed < period.fromMs || actualStartMs > period.toMs) {
    return [];
  }

  const startMs = Math.max(actualStartMs, period.fromMs);
  const endMs = active
    ? null
    : Math.min(actualEndMs as number, period.toMs);
  const truncated =
    actualStartMs < period.fromMs ||
    (actualEndMs !== null && actualEndMs > period.toMs);

  const elapsedMs = TimeCalculator.elapsedMs(
    actualStartMs,
    finalEndForElapsed,
    period,
  );

  // Launch-level human / inactive time.
  const allSpans: WorkInterval[] = invs.flatMap((i) => [...i.agentSpans]);
  const prompts = invs.flatMap((i) => [...i.promptsMs]);
  const { humanMs, inactiveMs } = TimeCalculator.humanActivity({
    launchStartMs: actualStartMs,
    promptsMs: prompts,
    agentIntervals: allSpans,
    period,
  });

  // Effective working-directory root per invocation.
  const effRootCache = new Map<string, string>();
  const effRoot = (inv: NormalizedInvocation): string => {
    const cached = effRootCache.get(inv.invocationId);
    if (cached !== undefined) {
      return cached;
    }
    let value: string;
    if (inv.cwd === undefined) {
      value = UNKNOWN;
    } else if (inv.isRoot || inv.parentId === undefined) {
      value = normalizePath(inv.cwd);
    } else {
      const parent = byId.get(inv.parentId);
      if (!parent) {
        value = normalizePath(inv.cwd);
      } else {
        const parentRoot = effRoot(parent);
        value =
          parentRoot !== UNKNOWN && isUnderOrEqual(inv.cwd, parentRoot)
            ? parentRoot
            : normalizePath(inv.cwd);
      }
    }
    effRootCache.set(inv.invocationId, value);
    return value;
  };

  // Aggregate agent-time per (interface, effective-root).
  const groups = new Map<
    string,
    { agent: NormalizedInvocation['interfaceId']; root: string; spans: WorkInterval[] }
  >();
  for (const inv of invs) {
    const root2 = effRoot(inv);
    const key = `${inv.interfaceId}\u0000${root2}`;
    const group = groups.get(key) ?? {
      agent: inv.interfaceId,
      root: root2,
      spans: [],
    };
    group.spans.push(...inv.agentSpans);
    groups.set(key, group);
  }

  const mainRoot = effRoot(root);
  const mainKey = `${root.interfaceId}\u0000${mainRoot}`;

  // Sub-agent count is launch-level. Readers that split a launch into several
  // invocations for other reasons (for example one segment per working
  // directory) mark those segments with `isSubagent: false`; readers that do
  // not set the marker keep the original "every non-root invocation" meaning.
  const subagentCount = invs.filter((i) => i.isSubagent ?? !i.isRoot).length;

  const rows: ReportRow[] = [];
  for (const [key, group] of groups.entries()) {
    const isMain = key === mainKey;
    const agentTimeMs = TimeCalculator.agentTimeMs(group.spans, period);
    rows.push({
      launchId,
      launchShort: '',
      agent: group.agent,
      path: group.root === UNKNOWN ? null : group.root,
      humanMs: isMain ? humanMs : 0,
      agentTimeMs,
      elapsedMs,
      inactiveMs: isMain ? inactiveMs : 0,
      startMs,
      endMs,
      actualStartMs,
      actualEndMs,
      truncated,
      active,
      subagentCount,
    });
  }
  return rows;
}
