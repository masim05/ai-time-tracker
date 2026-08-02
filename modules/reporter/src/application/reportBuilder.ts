import { NormalizedInvocation, InterfaceId } from '../../../session-reader';
import { ColumnId } from '../domain/column';
import { ReportRow } from '../domain/reportRow';
import { ColumnProjector, ProjectedReport } from './columnProjector';
import { FilterService } from './filterService';
import { GroupingService } from './groupingService';
import { assignLaunchShortIds } from './launchHasher';
import { Period } from './timeCalculator';

export interface BuildReportOptions {
  readonly period: Period;
  readonly agents?: Set<InterfaceId>;
  readonly expandedPaths?: readonly string[];
  readonly columnIds: readonly ColumnId[];
}

export interface BuiltReport {
  readonly projected: ProjectedReport;
  readonly rowCount: number;
}

/**
 * Orchestrates grouping, filtering, launch-id assignment, sorting, and column
 * projection into a final projected report. Pure: no I/O.
 */
export const ReportBuilder = {
  build(
    invocations: readonly NormalizedInvocation[],
    options: BuildReportOptions,
  ): BuiltReport {
    let rows: ReportRow[] = GroupingService.build(invocations, options.period);
    rows = FilterService.filterRows(rows, {
      agents: options.agents,
      expandedPaths: options.expandedPaths,
    });

    rows.sort(compareRows);

    const shortIds = assignLaunchShortIds(rows.map((r) => r.launchId));
    for (const row of rows) {
      row.launchShort = shortIds.get(row.launchId) ?? row.launchId;
    }

    const projected = ColumnProjector.project(rows, options.columnIds);
    return { projected, rowCount: rows.length };
  },
};

function compareRows(a: ReportRow, b: ReportRow): number {
  if (a.segmentStartMs !== b.segmentStartMs) {
    return a.segmentStartMs - b.segmentStartMs;
  }
  if (a.launchId !== b.launchId) {
    return a.launchId < b.launchId ? -1 : 1;
  }
  if (a.agent !== b.agent) {
    return a.agent < b.agent ? -1 : 1;
  }
  const pa = a.path ?? '\uffff';
  const pb = b.path ?? '\uffff';
  if (pa !== pb) {
    return pa < pb ? -1 : 1;
  }
  return 0;
}
