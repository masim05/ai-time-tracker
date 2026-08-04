import {
  NormalizedInvocation,
  SessionNameEvent,
  WorkInterval,
  clipInterval,
} from '../../../session-reader';
import { ReportRow } from '../domain/reportRow';
import { isUnderOrEqual, normalizePath } from '../domain/pathUtils';
import { Period, TimeCalculator } from './timeCalculator';

const UNKNOWN = '\u0000unknown';

/**
 * Groups normalized invocations into report rows.
 *
 * Row identity is `launch × agent (interface) × effective working-directory
 * root × temporal session-name segment`.
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
      rows.push(...buildLaunchRows(launchId, invs, period));
    }
    return rows;
  },
};

interface NameSegment {
  readonly startMs: number;
  readonly endMs: number;
  readonly name: string | null;
}

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
  const clippedLaunchStartMs = Math.max(actualStartMs, period.fromMs);
  const clippedLaunchEndMs = Math.min(finalEndForElapsed, period.toMs);
  if (clippedLaunchEndMs < period.fromMs || clippedLaunchStartMs > period.toMs) {
    return [];
  }

  const truncated =
    actualStartMs < period.fromMs ||
    (actualEndMs !== null && actualEndMs > period.toMs);

  // Launch-level human/inactive inputs.
  const allSpans: WorkInterval[] = invs.flatMap((i) => [...i.agentSpans]);
  const prompts = invs.flatMap((i) => [...i.promptsMs]);

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

  // Aggregate spans per (interface, effective-root).
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

  // Sub-agent count is launch-level.
  const subagentCount = invs.filter((i) => i.isSubagent ?? !i.isRoot).length;

  const nameSegments = buildNameSegments(
    normalizeNameEvents(root.sessionNameEvents ?? []),
    clippedLaunchStartMs,
    clippedLaunchEndMs,
  );

  const rows: ReportRow[] = [];
  for (const segment of nameSegments) {
    const segmentPeriod: Period = {
      fromMs: segment.startMs,
      toMs: segment.endMs,
    };
    const segmentElapsedMs = TimeCalculator.elapsedMs(
      actualStartMs,
      finalEndForElapsed,
      segmentPeriod,
    );
    const segmentHuman = TimeCalculator.humanActivity({
      launchStartMs: actualStartMs,
      promptsMs: prompts,
      agentIntervals: allSpans,
      period: segmentPeriod,
    });
    const openEndedSegment = active && segment.endMs === clippedLaunchEndMs;

    for (const [key, group] of groups.entries()) {
      const isMain = key === mainKey;
      const clippedSpans = group.spans
        .map((span) =>
          clipInterval(span, segment.startMs, segment.endMs),
        )
        .filter((span): span is WorkInterval => span !== null);
      const agentTimeMs = TimeCalculator.agentTimeMs(
        clippedSpans,
        segmentPeriod,
      );
      rows.push({
        launchId,
        launchShort: '',
        agent: group.agent,
        path: group.root === UNKNOWN ? null : group.root,
        name: segment.name,
        humanMs: isMain ? segmentHuman.humanMs : 0,
        agentTimeMs,
        elapsedMs: segmentElapsedMs,
        inactiveMs: isMain ? segmentHuman.inactiveMs : 0,
        startMs: segment.startMs,
        endMs: openEndedSegment ? null : segment.endMs,
        actualStartMs,
        actualEndMs,
        truncated,
        active,
        subagentCount,
        segmentStartMs: segment.startMs,
      });
    }
  }

  return rows;
}

function normalizeNameEvents(
  events: readonly SessionNameEvent[],
): SessionNameEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.timestampMs - b.timestampMs || a.name.localeCompare(b.name),
  );
  const deduped: SessionNameEvent[] = [];
  for (const event of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.name === event.name) {
      continue;
    }
    deduped.push(event);
  }
  return deduped;
}

function buildNameSegments(
  events: readonly SessionNameEvent[],
  launchStartMs: number,
  launchEndMs: number,
): NameSegment[] {
  if (launchEndMs <= launchStartMs) {
    return [];
  }

  let currentName: string | null = null;
  for (const event of events) {
    if (event.timestampMs <= launchStartMs) {
      currentName = event.name;
    }
  }

  const eventsInRange = events.filter(
    (event) => event.timestampMs > launchStartMs && event.timestampMs < launchEndMs,
  );
  const segments: NameSegment[] = [];
  let currentStart = launchStartMs;
  for (const event of eventsInRange) {
    segments.push({
      startMs: currentStart,
      endMs: event.timestampMs,
      name: currentName,
    });
    currentName = event.name;
    currentStart = event.timestampMs;
  }
  segments.push({
    startMs: currentStart,
    endMs: launchEndMs,
    name: currentName,
  });
  return segments;
}
