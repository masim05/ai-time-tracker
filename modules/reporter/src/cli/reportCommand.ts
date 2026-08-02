import { Command } from 'commander';
import {
  Diagnostic,
  NormalizedInvocation,
} from '../../../session-reader';
import { COLUMNS } from '../domain/column';
import { ColumnProjector } from '../application/columnProjector';
import { FilterService } from '../application/filterService';
import { ReportBuilder } from '../application/reportBuilder';
import {
  INITIAL_THRESHOLD_MS,
  SUBSEQUENT_THRESHOLD_MS,
} from '../application/timeCalculator';
import { UsageError } from '../application/errors';
import { DateTimeParser, OffsetResolver } from './dateTimeParser';
import { formatIsoWithOffset } from './formatUtils';
import { TableFormatter } from './tableFormatter';
import { JsonFormatter } from './jsonFormatter';
import { CsvFormatter } from './csvFormatter';

/** Raw option values as parsed from the command line. */
export interface RawReportOptions {
  from?: string;
  to?: string;
  output?: string;
  path?: string[];
  agent?: string[];
  columns?: string[];
  verbose?: boolean;
}

/** Injected dependencies for the report logic. */
export interface ReportDeps {
  readSessions(): {
    invocations: readonly NormalizedInvocation[];
    diagnostics: readonly Diagnostic[];
  };
  now(): number;
  readonly homeDir: string;
  readonly cwd: string;
  readonly offsetAt?: OffsetResolver;
}

export interface ReportRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const OUTPUT_FORMATS = new Set(['table', 'json', 'csv']);

/**
 * Pure report logic: parses options, reads sessions via the injected source,
 * builds and formats the report, and computes the exit code. Never touches
 * `process` directly, so it is fully unit-testable.
 */
export function runReport(
  opts: RawReportOptions,
  deps: ReportDeps,
): ReportRunResult {
  try {
    const toMs = opts.to
      ? DateTimeParser.parse(opts.to, deps.offsetAt)
      : deps.now();
    const fromMs = opts.from
      ? DateTimeParser.parse(opts.from, deps.offsetAt)
      : Number.NEGATIVE_INFINITY;
    if (opts.to !== undefined && fromMs > toMs) {
      throw new UsageError('--from must not be later than --to.');
    }

    const output = opts.output ?? 'table';
    if (!OUTPUT_FORMATS.has(output)) {
      throw new UsageError(
        `Unknown output format: '${output}'. Valid formats: table, json, csv.`,
      );
    }

    const agents =
      opts.agent && opts.agent.length > 0
        ? FilterService.resolveAgentFilters(opts.agent)
        : undefined;
    const columnIds = ColumnProjector.resolveColumns(opts.columns);
    const expandedPaths =
      opts.path && opts.path.length > 0
        ? FilterService.expandPathFilters(opts.path, {
            homeDir: deps.homeDir,
            cwd: deps.cwd,
          })
        : undefined;

    const { invocations, diagnostics } = deps.readSessions();
    const built = ReportBuilder.build(invocations, {
      period: { fromMs, toMs },
      agents,
      expandedPaths,
      columnIds,
    });

    let stdout: string;
    if (output === 'json') {
      stdout = new JsonFormatter().format(built.projected);
    } else if (output === 'csv') {
      stdout = new CsvFormatter().format(built.projected);
    } else {
      stdout = new TableFormatter({ homeDir: deps.homeDir }).format(
        built.projected,
      );
    }

    const stderrParts: string[] = [];
    if (built.rowCount === 0) {
      stderrParts.push('No matching sessions found.');
    }
    stderrParts.push(...formatDiagnostics(diagnostics, opts.verbose === true));

    const hasError = diagnostics.some((d) => d.severity === 'error');
    return {
      stdout,
      stderr: stderrParts.join('\n'),
      exitCode: hasError ? 1 : 0,
    };
  } catch (err) {
    if (err instanceof UsageError) {
      return { stdout: '', stderr: err.message, exitCode: 2 };
    }
    throw err;
  }
}

function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  verbose: boolean,
): string[] {
  if (diagnostics.length === 0) {
    return [];
  }
  if (!verbose) {
    const errors = diagnostics.filter((d) => d.severity === 'error').length;
    const warnings = diagnostics.length - errors;
    const parts: string[] = [];
    if (errors > 0) {
      parts.push(
        `${errors} record(s) could not be read; re-run with --verbose for details.`,
      );
    }
    if (warnings > 0) {
      parts.push(
        `${warnings} warning(s); re-run with --verbose for details.`,
      );
    }
    return parts;
  }
  return diagnostics.map((d) => {
    const fields = [`provider=${d.provider}`];
    if (d.interfaceId) fields.push(`interface=${d.interfaceId}`);
    if (d.sessionId) fields.push(`session=${d.sessionId}`);
    if (d.filePath) fields.push(`file=${d.filePath}`);
    if (d.eventType) fields.push(`event=${d.eventType}`);
    if (d.timestampMs) fields.push(`ts=${formatIsoWithOffset(d.timestampMs)}`);
    fields.push(`reason=${d.reason}`);
    return `[${d.severity}] ${fields.join(' ')}`;
  });
}

/** Builds the Commander `report` subcommand wired to {@link runReport}. */
export function buildReportCommand(deps: ReportDeps): Command {
  const command = new Command('report');
  command
    .description('Report cross-agent session activity time.')
    .option(
      '-f, --from <datetime>',
      'Start of the report period (default: beginning of history).',
    )
    .option(
      '-t, --to <datetime>',
      'End of the report period (default: now).',
    )
    .option(
      '-o, --output <format>',
      'Output format: table, json, or csv.',
      'table',
    )
    .option(
      '-p, --path <directory>',
      'Only include activity under this directory (repeatable).',
      collect,
      [],
    )
    .option(
      '-a, --agent <agent>',
      'Only include this agent: copilot-cli, codex-cli, codex-app, claude-cli, copilot, codex, claude (repeatable).',
      collect,
      [],
    )
    .option(
      '-c, --columns <selection>',
      'Column selection (replacement list or +/- modifications).',
      collect,
      [],
    )
    .option('-v, --verbose', 'Emit per-record diagnostics to stderr.', false)
    .addHelpText('after', REPORT_HELP)
    .action((options: Record<string, unknown>) => {
      const result = runReport(
        {
          from: options.from as string | undefined,
          to: options.to as string | undefined,
          output: options.output as string | undefined,
          path: options.path as string[] | undefined,
          agent: options.agent as string[] | undefined,
          columns: options.columns as string[] | undefined,
          verbose: options.verbose as boolean | undefined,
        },
        deps,
      );
      if (result.stdout) {
        process.stdout.write(result.stdout + '\n');
      }
      if (result.stderr) {
        process.stderr.write(result.stderr + '\n');
      }
      process.exitCode = result.exitCode;
    });
  return command;
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

const columnDocs = COLUMNS.map((c) => `    ${c.id.padEnd(13)} ${c.help}`).join(
  '\n',
);

/** Detailed help appended to `report --help`. */
export const REPORT_HELP = `
Agents (--agent):
  Exact interfaces: copilot-cli, codex-cli, codex-app, claude-cli.
  Families: copilot, codex, claude. Repeat --agent to select several; the
  selections are unioned and never duplicate a row.
  claude-cli covers developer-invoked Claude Code CLI sessions, including its
  background jobs. Sessions driven by an embedded Agent SDK are out of scope
  and are reported as a skipped count instead.
  claude-app and claude-vsc are not supported: no local session data for the
  Claude desktop application or VS Code integration could be discovered on
  Linux or macOS. Selecting them is a usage error rather than an empty report.

Datetime formats (--from / --to):
  ISO 8601 (with offset/Z), YYYYMMDD, YYYYMMDD-HHmm, YYYYMMDD-HHmmss,
  YYYY-MM-DD, YYYY-MM-DD-HHmm, YYYY-MM-DD-HHmmss.
  Missing time defaults to 00:00:00; missing timezone uses machine-local time;
  a DST-ambiguous local time without an explicit offset is rejected.

Columns (17 total; default: launch, agent, path, name, human, agent-time, start, duration, subagents):
${columnDocs}

  --columns replacement mode: comma-separated bare ids, e.g. 'start,inactive'.
  --columns modification mode: signed ids applied to defaults, e.g. '-start,+inactive'.
  Signed and unsigned tokens must not be mixed.

Time calculation:
  name        Explicit provider-persisted session name active for the row segment.
              Unset name renders as '-' (table), null (json), or empty (csv).
              Rows are split at persisted rename boundaries in timestamp order.
              Latest-only provider name storage is applied launch-wide with a warning.
  agent-time  Starts at a human prompt; ends when the parent and all sub-agents
              finish. Parent and sub-agent spans are additive, including overlaps.
              Cancelled/failed work counts through the cancellation/failure time.
  human       Idle before a prompt, never while an agent is active:
              initial interval (launch -> first prompt) counts when <= ${INITIAL_THRESHOLD_MS / 60000} min;
              subsequent intervals (completion -> next prompt) count when <= ${SUBSEQUENT_THRESHOLD_MS / 60000} min.
              Attributed once to the main agent's root row.
  inactive    Idle intervals excluded from human time by those thresholds.
  elapsed     Launch start to final completion, clipped to the report period;
              repeated (non-additively) across a launch's rows.
  duration    Session duration (same as elapsed); shown by default.
              Use 'elapsed' as a selectable alias.
  subagents   Total sub-agents invoked during the launch; non-additive
              across path rows; 0 when no sub-agents were started.

Output:
  table  Aligned columns, local timestamps, durations like 0m / 3m / 10h3m / 2d10h3m,
         and ~ for the home directory.
  json   Array of objects; durations as integer minutes; ISO 8601 timestamps with
         UTC offset; null for an active session's end.
  csv    Header row plus data rows with the same numeric/timestamp conventions;
         an empty field for an active session's end.

Diagnostics:
  --verbose prints per-record diagnostics to stderr (provider, interface, session
  id, file path, event type, timestamp, reason). Diagnostics never include prompts,
  responses, source code, or tool output.

Exit codes:
  0  Success (an empty result is allowed).
  1  Partial failure (some records were malformed or inaccessible).
  2  Invalid usage.

Examples:
  ai-time-tracker report
  ai-time-tracker report --agent codex --from 2026-07-25
  ai-time-tracker report --output json --path ~/projects/myapp
  ai-time-tracker report --columns '-start,+inactive,+actual-start'
`;
