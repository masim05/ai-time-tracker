import * as fs from 'fs';
import * as path from 'path';
import { ISessionReader } from '../application/ports';
import {
  Diagnostic,
  NormalizedInvocation,
  ReadResult,
  WorkInterval,
} from '../domain/models';

/** Options for {@link ClaudeCliReader}, allowing fixture directories in tests. */
export interface ClaudeCliReaderOptions {
  /** Base `.claude` directory. Defaults to `~/.claude`. */
  readonly baseDir: string;
  /**
   * Liveness probe for a launch registered in `sessions/<pid>.json`. Defaults
   * to a read-only check of the running process, guarded against pid reuse by
   * comparing the recorded `procStart` with the process start time.
   */
  readonly isPidAlive?: (pid: number, procStart?: string) => boolean;
}

/** A single parsed transcript record (only the fields this reader needs). */
export interface ClaudeTranscriptRecord {
  type?: string;
  uuid?: string;
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  entrypoint?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  promptSource?: string;
  toolUseResult?: unknown;
  sourceToolAssistantUUID?: string;
  sourceToolUseID?: string;
}

/** A transcript file that survived parsing. */
interface ParsedSession {
  readonly sessionId: string;
  readonly filePath: string;
  readonly sessionDir: string;
  readonly records: readonly ClaudeTranscriptRecord[];
  readonly firstTsMs: number;
  readonly lastTsMs: number;
}

/** One contiguous run of records sharing a working directory. */
interface Segment {
  cwd: string | undefined;
  startMs: number;
  endMs: number;
  promptsMs: number[];
  spans: WorkInterval[];
}

/** Live-launch registry entry (`~/.claude/sessions/<pid>.json`). */
interface SessionRegistryEntry {
  readonly pid: number;
  readonly procStart?: string;
}

/**
 * `promptSource` values that represent real human input. `system` marks
 * injected notifications (task notifications, command output) and `sdk` marks
 * programmatic prompts; neither is a developer submitting a prompt. The value
 * is absent in older transcripts, which are treated as human input.
 */
const HUMAN_PROMPT_SOURCES = new Set([
  'typed',
  'queued',
  'suggestion_accepted',
]);

/**
 * Reads developer-invoked Claude Code CLI sessions from `~/.claude`:
 * `projects/<slug>/<sessionId>.jsonl` transcripts, their
 * `<sessionId>/subagents/agent-*.jsonl` sub-agent transcripts, and the
 * `sessions/<pid>.json` live-launch registry.
 *
 * Sessions driven by an embedded Agent SDK (`entrypoint` other than `cli`) are
 * out of scope and skipped with a counted diagnostic. All file access is
 * read-only and no record content ever reaches a diagnostic.
 */
export class ClaudeCliReader implements ISessionReader {
  private readonly baseDir: string;
  private readonly isPidAlive: (pid: number, procStart?: string) => boolean;

  constructor(options: ClaudeCliReaderOptions) {
    this.baseDir = options.baseDir;
    this.isPidAlive = options.isPidAlive ?? defaultIsPidAlive;
  }

  read(): ReadResult {
    const invocations: NormalizedInvocation[] = [];
    const diagnostics: Diagnostic[] = [];

    const projectsRoot = path.join(this.baseDir, 'projects');
    let projectDirs: fs.Dirent[];
    try {
      projectDirs = fs.readdirSync(projectsRoot, { withFileTypes: true });
    } catch {
      // No Claude sessions on this machine — not an error.
      return { invocations, diagnostics };
    }

    const sessions: ParsedSession[] = [];
    let skippedNonCli = 0;

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) {
        continue;
      }
      const dir = path.join(projectsRoot, projectDir.name);
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        diagnostics.push({
          provider: 'claude',
          interfaceId: 'claude-cli',
          filePath: dir,
          reason: 'project directory could not be read',
          severity: 'error',
        });
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
          continue;
        }
        const filePath = path.join(dir, entry.name);
        const sessionId = entry.name.slice(0, -'.jsonl'.length);
        const records = this.parseTranscript(filePath, sessionId, diagnostics);
        if (records === null || records.length === 0) {
          continue;
        }
        if (entrypointOf(records) !== 'cli') {
          skippedNonCli++;
          continue;
        }
        const bounds = timestampBounds(records);
        if (bounds === null) {
          diagnostics.push({
            provider: 'claude',
            interfaceId: 'claude-cli',
            sessionId,
            filePath,
            reason: 'session has no usable timestamp',
            severity: 'warning',
          });
          continue;
        }
        sessions.push({
          sessionId,
          filePath,
          sessionDir: path.join(dir, sessionId),
          records,
          firstTsMs: bounds.firstTsMs,
          lastTsMs: bounds.lastTsMs,
        });
      }
    }

    if (skippedNonCli > 0) {
      diagnostics.push({
        provider: 'claude',
        reason:
          `${skippedNonCli} session(s) skipped: driven by an embedded Agent SDK ` +
          '(entrypoint other than "cli"), which is out of scope for this report',
        severity: 'warning',
      });
    }

    // Oldest launch first, so a resumed launch never claims records that were
    // already recorded by the launch it resumed. A resume replays the earlier
    // launch's first record, so first timestamps tie: the launch that stopped
    // earlier is the original, and the session id keeps the order total.
    sessions.sort(
      (a, b) =>
        a.firstTsMs - b.firstTsMs ||
        a.lastTsMs - b.lastTsMs ||
        a.sessionId.localeCompare(b.sessionId),
    );

    const claimedUuids = new Set<string>();
    const registry = this.readSessionRegistry(diagnostics);

    for (const session of sessions) {
      const own = session.records.filter((record) => {
        if (typeof record.uuid !== 'string') {
          return true;
        }
        if (claimedUuids.has(record.uuid)) {
          return false;
        }
        claimedUuids.add(record.uuid);
        return true;
      });

      const active = this.isSessionActive(session.sessionId, registry);
      this.buildLaunch(session, own, active, invocations, diagnostics);
    }

    return { invocations, diagnostics };
  }

  /** Parses a JSONL transcript. Returns `null` when the file is unreadable. */
  private parseTranscript(
    filePath: string,
    sessionId: string,
    diagnostics: Diagnostic[],
  ): ClaudeTranscriptRecord[] | null {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      diagnostics.push({
        provider: 'claude',
        interfaceId: 'claude-cli',
        sessionId,
        filePath,
        reason: 'transcript could not be read',
        severity: 'error',
      });
      return null;
    }

    const records: ClaudeTranscriptRecord[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        records.push(JSON.parse(line) as ClaudeTranscriptRecord);
      } catch {
        diagnostics.push({
          provider: 'claude',
          interfaceId: 'claude-cli',
          sessionId,
          filePath,
          eventType: 'jsonl-line',
          reason: `malformed JSON at line ${i + 1}`,
          severity: 'error',
        });
      }
    }
    return records;
  }

  /**
   * Builds the launch root, one extra invocation per working-directory change,
   * and one invocation per sub-agent transcript.
   */
  private buildLaunch(
    session: ParsedSession,
    ownRecords: readonly ClaudeTranscriptRecord[],
    active: boolean,
    out: NormalizedInvocation[],
    diagnostics: Diagnostic[],
  ): void {
    const timed = ownRecords
      .map((record) => ({ record, ts: parseTimestampMs(record.timestamp) }))
      .filter((entry): entry is { record: ClaudeTranscriptRecord; ts: number } => entry.ts !== null)
      .sort((a, b) => a.ts - b.ts);

    if (timed.length === 0) {
      // Every record was already attributed to the launch this one resumed.
      return;
    }

    const segments: Segment[] = [];
    let current: Segment | null = null;
    const prompts: { ts: number; segment: Segment }[] = [];
    const activity: number[] = [];

    // Metadata records (file-history deltas, queue operations) carry no `cwd`;
    // they continue the current segment instead of opening an `unknown` one.
    const firstCwd = timed.find((entry) => entry.record.cwd !== undefined)?.record
      .cwd;

    for (const { record, ts } of timed) {
      if (current === null) {
        current = {
          cwd: record.cwd ?? firstCwd,
          startMs: ts,
          endMs: ts,
          promptsMs: [],
          spans: [],
        };
        segments.push(current);
      } else if (record.cwd !== undefined && record.cwd !== current.cwd) {
        current = {
          cwd: record.cwd,
          startMs: ts,
          endMs: ts,
          promptsMs: [],
          spans: [],
        };
        segments.push(current);
      }
      current.endMs = Math.max(current.endMs, ts);

      if (isHumanPrompt(record)) {
        current.promptsMs.push(ts);
        prompts.push({ ts, segment: current });
      } else if (isAgentActivity(record)) {
        activity.push(ts);
      }
    }

    // A span runs from a prompt to the last agent activity before the next
    // prompt: cancellations and interruptions are counted through their last
    // recorded activity, and a prompt with no activity yields a zero-length span.
    for (let i = 0; i < prompts.length; i++) {
      const start = prompts[i].ts;
      const limit = i + 1 < prompts.length ? prompts[i + 1].ts : Number.POSITIVE_INFINITY;
      let end = start;
      for (const ts of activity) {
        if (ts >= start && ts < limit && ts > end) {
          end = ts;
        }
      }
      prompts[i].segment.spans.push({ startMs: start, endMs: end });
    }

    const rootId = session.sessionId;
    segments.forEach((segment, index) => {
      const isRoot = index === 0;
      const isLast = index === segments.length - 1;
      out.push({
        provider: 'claude',
        interfaceId: 'claude-cli',
        launchRootId: rootId,
        invocationId: isRoot ? rootId : `${rootId}::cwd::${index}`,
        parentId: isRoot ? undefined : rootId,
        cwd: segment.cwd,
        isRoot,
        isSubagent: false,
        promptsMs: segment.promptsMs,
        agentSpans: segment.spans,
        startMs: segment.startMs,
        endMs: active && isLast ? null : segment.endMs,
      });
    });

    this.readSubagents(session, rootId, out, diagnostics);
  }

  /** Emits one invocation per `<sessionId>/subagents/agent-*.jsonl` transcript. */
  private readSubagents(
    session: ParsedSession,
    rootId: string,
    out: NormalizedInvocation[],
    diagnostics: Diagnostic[],
  ): void {
    const dir = path.join(session.sessionDir, 'subagents');
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      // Launches without sub-agents have no such directory.
      return;
    }

    for (const name of entries) {
      if (!name.endsWith('.jsonl')) {
        continue;
      }
      const filePath = path.join(dir, name);
      const agentId = name.slice(0, -'.jsonl'.length);
      const records = this.parseTranscript(filePath, session.sessionId, diagnostics);
      if (records === null) {
        continue;
      }
      const timestamps = records
        .map((record) => parseTimestampMs(record.timestamp))
        .filter((ts): ts is number => ts !== null)
        .sort((a, b) => a - b);
      if (timestamps.length === 0) {
        diagnostics.push({
          provider: 'claude',
          interfaceId: 'claude-cli',
          sessionId: session.sessionId,
          filePath,
          eventType: 'subagent',
          reason: 'sub-agent transcript has no usable timestamp',
          severity: 'warning',
        });
        continue;
      }

      const startMs = timestamps[0];
      const endMs = timestamps[timestamps.length - 1];
      const cwd = records.find((record) => record.cwd !== undefined)?.cwd;
      out.push({
        provider: 'claude',
        interfaceId: 'claude-cli',
        launchRootId: rootId,
        invocationId: `${rootId}::sub::${agentId}`,
        parentId: rootId,
        cwd,
        isRoot: false,
        isSubagent: true,
        promptsMs: [],
        agentSpans: [{ startMs, endMs }],
        startMs,
        endMs,
      });
    }
  }

  /** Indexes `sessions/<pid>.json` entries by session id. */
  private readSessionRegistry(
    diagnostics: Diagnostic[],
  ): Map<string, SessionRegistryEntry> {
    const registry = new Map<string, SessionRegistryEntry>();
    const dir = path.join(this.baseDir, 'sessions');
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return registry;
    }

    for (const name of entries) {
      if (!name.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(dir, name);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
          pid?: number;
          sessionId?: string;
          procStart?: string;
        };
        if (typeof parsed.sessionId === 'string' && typeof parsed.pid === 'number') {
          registry.set(parsed.sessionId, {
            pid: parsed.pid,
            procStart: parsed.procStart,
          });
        }
      } catch {
        diagnostics.push({
          provider: 'claude',
          interfaceId: 'claude-cli',
          filePath,
          reason: 'live-session registry entry could not be read',
          severity: 'warning',
        });
      }
    }
    return registry;
  }

  private isSessionActive(
    sessionId: string,
    registry: Map<string, SessionRegistryEntry>,
  ): boolean {
    const entry = registry.get(sessionId);
    if (!entry) {
      return false;
    }
    return this.isPidAlive(entry.pid, entry.procStart);
  }
}

/** True when the record is a developer-submitted prompt. */
export function isHumanPrompt(record: ClaudeTranscriptRecord): boolean {
  if (record.type !== 'user') {
    return false;
  }
  if (record.isSidechain === true || record.isMeta === true) {
    return false;
  }
  if (
    record.toolUseResult !== undefined ||
    record.sourceToolAssistantUUID !== undefined ||
    record.sourceToolUseID !== undefined
  ) {
    return false;
  }
  if (record.promptSource === undefined) {
    return true;
  }
  return HUMAN_PROMPT_SOURCES.has(record.promptSource);
}

/** True when the record is evidence of the agent working. */
export function isAgentActivity(record: ClaudeTranscriptRecord): boolean {
  if (record.type === 'assistant') {
    return true;
  }
  return record.type === 'user' && record.toolUseResult !== undefined;
}

/** First `entrypoint` value in the transcript, or `undefined` when absent. */
function entrypointOf(records: readonly ClaudeTranscriptRecord[]): string | undefined {
  for (const record of records) {
    if (typeof record.entrypoint === 'string') {
      return record.entrypoint;
    }
  }
  return undefined;
}

function timestampBounds(
  records: readonly ClaudeTranscriptRecord[],
): { firstTsMs: number; lastTsMs: number } | null {
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const record of records) {
    const ts = parseTimestampMs(record.timestamp);
    if (ts === null) {
      continue;
    }
    if (earliest === null || ts < earliest) {
      earliest = ts;
    }
    if (latest === null || ts > latest) {
      latest = ts;
    }
  }
  if (earliest === null || latest === null) {
    return null;
  }
  return { firstTsMs: earliest, lastTsMs: latest };
}

function parseTimestampMs(value: string | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Read-only liveness probe: signal `0` tests for process existence without
 * delivering a signal. On Linux the recorded `procStart` is compared with field
 * 22 of `/proc/<pid>/stat` so a reused pid is not mistaken for a live launch.
 */
function defaultIsPidAlive(pid: number, procStart?: string): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (procStart === undefined) {
    return true;
  }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // Field 2 (comm) may contain spaces and parentheses; parse after it.
    const afterComm = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    // Fields resume at index 0 == field 3, so field 22 is index 19.
    const startTime = afterComm[19];
    return startTime === undefined || startTime === procStart;
  } catch {
    // No procfs (for example macOS): fall back to liveness alone.
    return true;
  }
}
