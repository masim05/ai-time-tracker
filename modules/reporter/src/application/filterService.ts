import { InterfaceId } from '../../../session-reader';
import { ReportRow } from '../domain/reportRow';
import { isUnderOrEqual, normalizePath } from '../domain/pathUtils';
import { UsageError } from './errors';

const AGENT_ALIASES: Record<string, InterfaceId[]> = {
  'copilot-cli': ['copilot-cli'],
  'codex-cli': ['codex-cli'],
  'codex-app': ['codex-app'],
  'claude-cli': ['claude-cli'],
  copilot: ['copilot-cli'],
  codex: ['codex-cli', 'codex-app'],
  claude: ['claude-cli'],
};

/**
 * Interfaces named by the requirements whose session data could not be located
 * on any supported platform, so no reader can produce them. They are rejected
 * explicitly instead of silently returning an empty report.
 */
const UNSUPPORTED_AGENTS: Record<string, string> = {
  'claude-app': 'the Claude desktop application stores no local session data that could be discovered',
  'claude-vsc': 'the Claude VS Code integration stores no local session data that could be discovered',
};

/** Environment inputs required to expand user-supplied path filters. */
export interface PathExpandContext {
  readonly homeDir: string;
  readonly cwd: string;
}

/**
 * Pure filtering of report rows by agent and working directory. Path and agent
 * expansion are pure functions of their explicit inputs (no environment or
 * file-system access, and symlinks are never resolved).
 */
export const FilterService = {
  /**
   * Resolves `--agent` values (exact ids and `codex`/`copilot` families) into a
   * concrete set of interface ids. Repeated values union without duplicates.
   */
  resolveAgentFilters(raw: readonly string[]): Set<InterfaceId> {
    const set = new Set<InterfaceId>();
    for (const value of raw) {
      const unsupported = UNSUPPORTED_AGENTS[value];
      if (unsupported) {
        throw new UsageError(
          `Agent '${value}' is not supported: ${unsupported}.`,
        );
      }
      const mapped = AGENT_ALIASES[value];
      if (!mapped) {
        throw new UsageError(
          `Unknown agent value: '${value}'. Valid values: copilot-cli, codex-cli, codex-app, claude-cli, copilot, codex, claude.`,
        );
      }
      for (const id of mapped) {
        set.add(id);
      }
    }
    return set;
  },

  /**
   * Expands `--path` values: `~`/`~/...` to the home directory, relative paths
   * against `cwd`, and normalizes separators. Symlinks are not resolved.
   */
  expandPathFilters(
    raw: readonly string[],
    ctx: PathExpandContext,
  ): string[] {
    return raw.map((value) => {
      let p = value;
      if (p === '~') {
        p = ctx.homeDir;
      } else if (p.startsWith('~/')) {
        p = ctx.homeDir + '/' + p.slice(2);
      } else if (!p.startsWith('/')) {
        p = ctx.cwd + '/' + p;
      }
      return normalizePath(p);
    });
  },

  /** True when `rowPath` is under any expanded filter path. Unknown never matches. */
  matchesAnyPath(
    rowPath: string | null,
    expandedFilters: readonly string[],
  ): boolean {
    if (rowPath === null) {
      return false;
    }
    return expandedFilters.some((f) => isUnderOrEqual(rowPath, f));
  },

  /** Applies agent and path filters to a set of rows. */
  filterRows(
    rows: readonly ReportRow[],
    filters: {
      agents?: Set<InterfaceId>;
      expandedPaths?: readonly string[];
    },
  ): ReportRow[] {
    return rows.filter((row) => {
      if (filters.agents && filters.agents.size > 0 && !filters.agents.has(row.agent)) {
        return false;
      }
      if (filters.expandedPaths && filters.expandedPaths.length > 0) {
        if (!FilterService.matchesAnyPath(row.path, filters.expandedPaths)) {
          return false;
        }
      }
      return true;
    });
  },
};
