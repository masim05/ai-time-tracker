import { ReportRow } from './reportRow';

/** All supported report column ids. */
export type ColumnId =
  | 'launch'
  | 'launch-id'
  | 'agent'
  | 'path'
  | 'human'
  | 'agent-time'
  | 'elapsed'
  | 'duration'
  | 'inactive'
  | 'start'
  | 'end'
  | 'actual-start'
  | 'actual-end'
  | 'truncated'
  | 'active'
  | 'subagents';

/** How a raw cell value should be rendered by formatters. */
export type ColumnKind = 'text' | 'duration' | 'timestamp' | 'boolean';

/** Raw (unformatted) value extracted from a {@link ReportRow}. */
export type CellValue = string | number | boolean | null;

/** Declarative description of a report column. */
export interface ColumnSpec {
  readonly id: ColumnId;
  /** Header used in table/CSV output and as the JSON key. */
  readonly header: string;
  /** One-line help text shown in `report --help`. */
  readonly help: string;
  readonly kind: ColumnKind;
  /**
   * True when values from different rows can be safely summed (e.g. human,
   * agent-time, inactive). Non-additive columns (elapsed, duration, subagents)
   * are launch-level and repeat across path rows of the same launch.
   */
  readonly additive?: boolean;
  /** Extracts the raw cell value from a computed row. */
  readonly accessor: (row: ReportRow) => CellValue;
}

/** The full catalog of 16 columns, in canonical display order. */
export const COLUMNS: readonly ColumnSpec[] = [
  {
    id: 'launch',
    header: 'launch',
    help: 'Short deterministic launch id (<=6 chars).',
    kind: 'text',
    accessor: (r) => r.launchShort,
  },
  {
    id: 'launch-id',
    header: 'launch-id',
    help: 'Full deterministic launch id.',
    kind: 'text',
    accessor: (r) => r.launchId,
  },
  {
    id: 'agent',
    header: 'agent',
    help: 'Agent interface (copilot-cli, codex-cli, codex-app).',
    kind: 'text',
    accessor: (r) => r.agent,
  },
  {
    id: 'path',
    header: 'path',
    help: 'Effective working-directory root for the row (unknown if absent).',
    kind: 'text',
    accessor: (r) => r.path,
  },
  {
    id: 'human',
    header: 'human',
    help: 'Human-active time: idle intervals within threshold before a prompt.',
    kind: 'duration',
    additive: true,
    accessor: (r) => r.humanMs,
  },
  {
    id: 'agent-time',
    header: 'agent-time',
    help: 'Agent working time; additive across parent and sub-agents.',
    kind: 'duration',
    additive: true,
    accessor: (r) => r.agentTimeMs,
  },
  {
    id: 'elapsed',
    header: 'elapsed',
    help: 'Wall-clock launch duration, clipped to the report period.',
    kind: 'duration',
    accessor: (r) => r.elapsedMs,
  },
  {
    id: 'duration',
    header: 'duration',
    help: 'Session duration (same as elapsed). Shown by default; use elapsed as an alias.',
    kind: 'duration',
    accessor: (r) => r.elapsedMs,
  },
  {
    id: 'inactive',
    header: 'inactive',
    help: 'Idle intervals excluded from human-active time by the thresholds.',
    kind: 'duration',
    additive: true,
    accessor: (r) => r.inactiveMs,
  },
  {
    id: 'start',
    header: 'start',
    help: 'Launch start, clipped to the report period.',
    kind: 'timestamp',
    accessor: (r) => r.startMs,
  },
  {
    id: 'end',
    header: 'end',
    help: 'Launch end, clipped to the report period (empty/null if active).',
    kind: 'timestamp',
    accessor: (r) => r.endMs,
  },
  {
    id: 'actual-start',
    header: 'actual-start',
    help: 'Unclipped launch start.',
    kind: 'timestamp',
    accessor: (r) => r.actualStartMs,
  },
  {
    id: 'actual-end',
    header: 'actual-end',
    help: 'Unclipped launch end (empty/null if active).',
    kind: 'timestamp',
    accessor: (r) => r.actualEndMs,
  },
  {
    id: 'truncated',
    header: 'truncated',
    help: 'Whether the launch was clipped by the report period.',
    kind: 'boolean',
    accessor: (r) => r.truncated,
  },
  {
    id: 'active',
    header: 'active',
    help: 'Whether the launch is still active.',
    kind: 'boolean',
    accessor: (r) => r.active,
  },
  {
    id: 'subagents',
    header: 'subagents',
    help: 'Total number of sub-agents invoked during the launch (non-additive across path rows).',
    kind: 'text',
    accessor: (r) => r.subagentCount,
  },
];

/** Default columns, in order. */
export const DEFAULT_COLUMN_IDS: readonly ColumnId[] = [
  'launch',
  'agent',
  'path',
  'human',
  'agent-time',
  'start',
  'duration',
  'subagents',
];

const BY_ID = new Map<string, ColumnSpec>(COLUMNS.map((c) => [c.id, c]));

/** Returns the column spec for an id, or undefined when unknown. */
export function getColumn(id: string): ColumnSpec | undefined {
  return BY_ID.get(id);
}

/** All valid column ids. */
export const ALL_COLUMN_IDS: readonly ColumnId[] = COLUMNS.map((c) => c.id);
