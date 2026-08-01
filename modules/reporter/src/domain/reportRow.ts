import { InterfaceId } from '../../../session-reader/src/domain/models';

/**
 * A fully-computed report row. Row identity is
 * `launch × agent (interface) × effective working-directory root`.
 *
 * Durations are stored in milliseconds and rounded only for display.
 * Timestamps are epoch milliseconds. `path === null` means the working
 * directory is unknown.
 */
export interface ReportRow {
  /** Full deterministic launch id. */
  readonly launchId: string;
  /** Short (<=6 char) launch id assigned at projection time. */
  launchShort: string;
  readonly agent: InterfaceId;
  readonly path: string | null;
  readonly humanMs: number;
  readonly agentTimeMs: number;
  readonly elapsedMs: number;
  readonly inactiveMs: number;
  /** Clipped-to-period launch boundaries. */
  readonly startMs: number;
  readonly endMs: number | null;
  /** Unclipped actual launch boundaries. */
  readonly actualStartMs: number;
  readonly actualEndMs: number | null;
  /** True when the launch spans a report-period boundary and was clipped. */
  readonly truncated: boolean;
  /** True when the launch is still active (no final completion). */
  readonly active: boolean;
}
