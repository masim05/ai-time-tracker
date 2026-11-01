import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { ISessionReader } from '../application/ports';
import {
  Diagnostic,
  InterfaceId,
  NormalizedInvocation,
  ReadResult,
  SessionNameEvent,
  WorkInterval,
} from '../domain/models';
import { clusterTimestamps } from '../domain/interval';

/** Options for {@link CodexReader}, allowing fixture directories in tests. */
export interface CodexReaderOptions {
  /** Base `.codex` directory. Defaults to `~/.codex`. */
  readonly baseDir: string;
  /**
   * Idle gap (ms) used to cluster per-thread log timestamps into agent work
   * bursts. Defaults to 2 minutes.
   */
  readonly idleGapMs?: number;
}

interface ThreadRow {
  id: string;
  created_at_ms: number | null;
  updated_at_ms: number | null;
  cwd: string | null;
  thread_source: string | null;
  name?: unknown;
  title?: unknown;
  rollout_path?: unknown;
}

/** Turn activity derived from a thread's rollout JSONL. */
interface RolloutActivity {
  readonly spans: WorkInterval[];
  readonly prompts: number[];
}

const DEFAULT_IDLE_GAP_MS = 2 * 60 * 1000;

/** Import replays are stamped within about a second of `imported_at`; turns later than this are real. */
const IMPORT_REPLAY_TOLERANCE_MS = 60 * 1000;

const IMPORTS_FILE = 'external_agent_session_imports.json';

/**
 * Reads Codex CLI and Codex App sessions from the shared `~/.codex` backend:
 * `state_5.sqlite` (threads + spawn edges), per-thread rollout JSONL files
 * (turn-based agent activity and human prompts), `logs_2.sqlite` (thread
 * start/end activity, app detection, and fallback agent activity), and
 * `history.jsonl` (fallback human prompt timestamps).
 *
 * Imported threads (`external_agent_session_imports.json`) report only
 * post-import turns, or are skipped with a counted warning.
 *
 * All database handles are opened read-only.
 */
export class CodexReader implements ISessionReader {
  private readonly baseDir: string;
  private readonly idleGapMs: number;

  constructor(options: CodexReaderOptions) {
    this.baseDir = options.baseDir;
    this.idleGapMs = options.idleGapMs ?? DEFAULT_IDLE_GAP_MS;
  }

  read(): ReadResult {
    const invocations: NormalizedInvocation[] = [];
    const diagnostics: Diagnostic[] = [];

    const statePath = path.join(this.baseDir, 'state_5.sqlite');
    if (!fs.existsSync(statePath)) {
      diagnostics.push({
        provider: 'codex',
        filePath: statePath,
        reason: 'Codex state database not found',
        severity: 'warning',
      });
      return { invocations, diagnostics };
    }

    let threads: ThreadRow[];
    let edges: { parent_thread_id: string; child_thread_id: string }[];
    try {
      const state = new Database(statePath, { readonly: true, fileMustExist: true });
      try {
        const threadColumns = new Set(
          (
            state.prepare('PRAGMA table_info(threads)').all() as {
              name: string;
            }[]
          ).map((column) => column.name),
        );
        const titleSelection = threadColumns.has('title')
          ? 'title'
          : 'NULL AS title';
        const rolloutSelection = threadColumns.has('rollout_path')
          ? 'rollout_path'
          : 'NULL AS rollout_path';
        threads = state
          .prepare(
            `SELECT id, created_at_ms, updated_at_ms, cwd, thread_source, name, ${titleSelection}, ${rolloutSelection} FROM threads`,
          )
          .all() as ThreadRow[];
        edges = state
          .prepare(
            'SELECT parent_thread_id, child_thread_id FROM thread_spawn_edges',
          )
          .all() as { parent_thread_id: string; child_thread_id: string }[];
      } finally {
        state.close();
      }
    } catch {
      diagnostics.push({
        provider: 'codex',
        filePath: statePath,
        reason: 'Codex state database is corrupt or unreadable',
        severity: 'error',
      });
      return { invocations, diagnostics };
    }

    const parentOf = new Map<string, string>();
    for (const edge of edges) {
      parentOf.set(edge.child_thread_id, edge.parent_thread_id);
    }

    const logInfo = this.readLogInfo(diagnostics);
    const promptsByThread = this.readPrompts(diagnostics);
    const importedAt = this.readImports(diagnostics);
    let skippedImported = 0;

    for (const thread of threads) {
      if (thread.created_at_ms === null) {
        diagnostics.push({
          provider: 'codex',
          sessionId: thread.id,
          reason: 'thread has no creation timestamp',
          severity: 'warning',
        });
        continue;
      }
      const rootId = resolveRoot(thread.id, parentOf);
      const parentId = parentOf.get(thread.id);
      const interfaceId: InterfaceId = logInfo.appThreads.has(thread.id)
        ? 'codex-app'
        : 'codex-cli';

      if (importedAt.has(thread.id)) {
        const invocation = this.readImportedThread(
          thread,
          importedAt.get(thread.id) ?? null,
          { rootId, parentId, interfaceId },
          diagnostics,
        );
        if (invocation) {
          invocations.push(invocation);
        } else {
          skippedImported++;
        }
        continue;
      }

      const logTimestamps = logInfo.timestampsByThread.get(thread.id) ?? [];
      const logSpans: WorkInterval[] =
        logTimestamps.length > 0
          ? clusterTimestamps(logTimestamps, this.idleGapMs)
          : [{ startMs: thread.created_at_ms, endMs: thread.updated_at_ms ?? thread.created_at_ms }];

      // Thread start/end keep following thread metadata and log activity.
      const start = Math.min(
        thread.created_at_ms,
        ...logSpans.map((s) => s.startMs),
      );
      const end = Math.max(
        thread.updated_at_ms ?? thread.created_at_ms,
        ...logSpans.map((s) => s.endMs),
      );

      // Agent activity and prompts come from rollout turns when available;
      // log rows cover the whole open thread, so they are only a fallback.
      const rollout = this.readRollout(thread, diagnostics);
      const spans =
        rollout && rollout.spans.length > 0 ? rollout.spans : logSpans;

      const prompts =
        thread.thread_source === 'subagent'
          ? []
          : rollout && rollout.prompts.length > 0
            ? rollout.prompts
            : promptsByThread.get(thread.id) ?? [];

      invocations.push(
        buildInvocation(
          thread,
          { rootId, parentId, interfaceId },
          { prompts, spans, start, end },
          diagnostics,
        ),
      );
    }

    if (skippedImported > 0) {
      diagnostics.push({
        provider: 'codex',
        filePath: path.join(this.baseDir, IMPORTS_FILE),
        reason:
          `${skippedImported} Codex thread(s) skipped: imported from another agent's ` +
          'session history, with no Codex turns after the import',
        severity: 'warning',
      });
    }

    return { invocations, diagnostics };
  }

  /**
   * Builds an imported thread's invocation from its post-import rollout turns
   * only, or returns `undefined` when there are none and the thread is skipped.
   */
  private readImportedThread(
    thread: ThreadRow,
    importedAtMs: number | null,
    topology: ThreadTopology,
    diagnostics: Diagnostic[],
  ): NormalizedInvocation | undefined {
    if (importedAtMs === null) {
      return undefined;
    }
    const rollout = this.readRollout(
      thread,
      diagnostics,
      importedAtMs + IMPORT_REPLAY_TOLERANCE_MS,
    );
    if (!rollout || rollout.spans.length === 0) {
      return undefined;
    }
    const spans = rollout.spans;
    const prompts = thread.thread_source === 'subagent' ? [] : rollout.prompts;
    const start = Math.min(...spans.map((s) => s.startMs), ...prompts);
    const end = Math.max(...spans.map((s) => s.endMs));
    return buildInvocation(thread, topology, { prompts, spans, start, end }, diagnostics);
  }

  /**
   * Maps imported thread ids to their import time in ms (`null` when unknown).
   * Only `imported_thread_id` and `imported_at` are read from each record.
   */
  private readImports(diagnostics: Diagnostic[]): Map<string, number | null> {
    const importedAt = new Map<string, number | null>();
    const importsPath = path.join(this.baseDir, IMPORTS_FILE);
    if (!fs.existsSync(importsPath)) {
      return importedAt;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(importsPath, 'utf8'));
    } catch (error) {
      diagnostics.push({
        provider: 'codex',
        filePath: importsPath,
        reason:
          error instanceof SyntaxError
            ? 'Codex session imports file is malformed; imported threads cannot be identified'
            : 'Codex session imports file could not be read; imported threads cannot be identified',
        severity: 'warning',
      });
      return importedAt;
    }
    const records =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>).records
        : undefined;
    if (!Array.isArray(records)) {
      diagnostics.push({
        provider: 'codex',
        filePath: importsPath,
        reason: 'Codex session imports file is malformed; imported threads cannot be identified',
        severity: 'warning',
      });
      return importedAt;
    }
    let ignored = 0;
    for (const record of records) {
      const fields =
        typeof record === 'object' && record !== null
          ? (record as Record<string, unknown>)
          : undefined;
      const id = fields?.imported_thread_id;
      if (typeof id !== 'string' || id === '') {
        ignored++;
        continue;
      }
      const at = fields?.imported_at;
      const ms = typeof at === 'number' && Number.isFinite(at) ? at * 1000 : null;
      // Re-imports of the same thread: the latest import time bounds the replay.
      const previous = importedAt.get(id);
      const unknown = ms === null || previous === null;
      importedAt.set(id, unknown ? null : Math.max(previous ?? ms, ms));
    }
    if (ignored > 0) {
      diagnostics.push({
        provider: 'codex',
        filePath: importsPath,
        reason: `${ignored} Codex session import record(s) ignored: no imported thread id`,
        severity: 'warning',
      });
    }
    return importedAt;
  }

  private readLogInfo(diagnostics: Diagnostic[]): {
    timestampsByThread: Map<string, number[]>;
    appThreads: Set<string>;
  } {
    const timestampsByThread = new Map<string, number[]>();
    const appThreads = new Set<string>();
    const logsPath = path.join(this.baseDir, 'logs_2.sqlite');
    if (!fs.existsSync(logsPath)) {
      return { timestampsByThread, appThreads };
    }
    try {
      const db = new Database(logsPath, { readonly: true, fileMustExist: true });
      try {
        // Processes that emitted app-server logs are Codex App processes.
        const appProcs = new Set(
          (
            db
              .prepare(
                "SELECT DISTINCT process_uuid AS p FROM logs WHERE target LIKE 'codex_app_server::%'",
              )
              .all() as { p: string | null }[]
          )
            .map((r) => r.p)
            .filter((p): p is string => !!p),
        );
        const rows = db
          .prepare(
            'SELECT thread_id, process_uuid, ts, ts_nanos FROM logs WHERE thread_id IS NOT NULL',
          )
          .all() as {
          thread_id: string;
          process_uuid: string | null;
          ts: number | null;
          ts_nanos: number | null;
        }[];
        for (const row of rows) {
          if (row.ts === null) {
            continue;
          }
          const ms = row.ts * 1000 + Math.floor((row.ts_nanos ?? 0) / 1_000_000);
          const list = timestampsByThread.get(row.thread_id) ?? [];
          list.push(ms);
          timestampsByThread.set(row.thread_id, list);
          if (row.process_uuid && appProcs.has(row.process_uuid)) {
            appThreads.add(row.thread_id);
          }
        }
      } finally {
        db.close();
      }
    } catch {
      diagnostics.push({
        provider: 'codex',
        filePath: logsPath,
        reason: 'Codex logs database is corrupt or unreadable',
        severity: 'warning',
      });
    }
    return { timestampsByThread, appThreads };
  }

  /**
   * Derives turn spans and human prompts from a thread's rollout JSONL.
   *
   * Privacy: only `timestamp`, `type`, `payload.type`, and
   * `payload.turn_attribution.turn_trigger` are inspected; no other record
   * content is retained or emitted in diagnostics. Returns `undefined` when
   * the thread has no rollout or the file cannot be read. Turn events at or
   * before `notAfterMs`, when given, are ignored.
   */
  private readRollout(
    thread: ThreadRow,
    diagnostics: Diagnostic[],
    notAfterMs?: number,
  ): RolloutActivity | undefined {
    if (typeof thread.rollout_path !== 'string' || thread.rollout_path.trim() === '') {
      return undefined;
    }
    const rolloutPath = path.resolve(this.baseDir, thread.rollout_path);
    if (!fs.existsSync(rolloutPath)) {
      diagnostics.push({
        provider: 'codex',
        sessionId: thread.id,
        filePath: rolloutPath,
        reason: 'Codex rollout file not found',
        severity: 'warning',
      });
      return undefined;
    }
    let text: string;
    try {
      text = fs.readFileSync(rolloutPath, 'utf8');
    } catch {
      diagnostics.push({
        provider: 'codex',
        sessionId: thread.id,
        filePath: rolloutPath,
        reason: 'Codex rollout file could not be read',
        severity: 'warning',
      });
      return undefined;
    }

    const spans: WorkInterval[] = [];
    const prompts: number[] = [];
    let open: { startMs: number; attributed: boolean } | undefined;
    let lastTimestampMs: number | undefined;
    let untimedAfterLast = false;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      let record: RolloutLineFields;
      try {
        record = pickRolloutFields(JSON.parse(line));
      } catch {
        diagnostics.push({
          provider: 'codex',
          sessionId: thread.id,
          filePath: rolloutPath,
          eventType: 'jsonl-line',
          reason: `malformed rollout line ${i + 1}`,
          severity: 'warning',
        });
        continue;
      }
      const ms = record.timestamp !== undefined ? Date.parse(record.timestamp) : NaN;
      const hasTime = Number.isFinite(ms);
      if (hasTime) {
        lastTimestampMs = lastTimestampMs === undefined ? ms : Math.max(lastTimestampMs, ms);
        untimedAfterLast = false;
      } else {
        untimedAfterLast = true;
      }
      if (record.type !== 'event_msg') {
        continue;
      }
      const eventType = record.payloadType;
      if (
        eventType !== 'task_started' &&
        eventType !== 'task_complete' &&
        eventType !== 'turn_aborted' &&
        eventType !== 'user_message'
      ) {
        continue;
      }
      if (!hasTime) {
        diagnostics.push({
          provider: 'codex',
          sessionId: thread.id,
          filePath: rolloutPath,
          eventType,
          reason: `rollout turn event on line ${i + 1} has no valid timestamp`,
          severity: 'warning',
        });
        continue;
      }
      if (notAfterMs !== undefined && ms <= notAfterMs) {
        continue;
      }
      if (eventType === 'task_started') {
        if (open) {
          // A new turn implicitly ends a turn that never completed.
          spans.push({ startMs: open.startMs, endMs: Math.max(open.startMs, ms) });
        }
        const attributed = record.turnTrigger !== undefined;
        open = { startMs: ms, attributed };
        if (record.turnTrigger === 'user') {
          prompts.push(ms);
        }
      } else if (eventType === 'user_message') {
        if (open && !open.attributed) {
          prompts.push(ms);
        }
      } else if (open) {
        spans.push({ startMs: open.startMs, endMs: Math.max(open.startMs, ms) });
        open = undefined;
      }
    }

    if (open) {
      let endMs = lastTimestampMs ?? open.startMs;
      if (untimedAfterLast && thread.updated_at_ms !== null) {
        endMs = Math.max(endMs, thread.updated_at_ms);
      }
      spans.push({ startMs: open.startMs, endMs: Math.max(open.startMs, endMs) });
    }

    return {
      spans,
      prompts: [...new Set(prompts)].sort((a, b) => a - b),
    };
  }

  private readPrompts(diagnostics: Diagnostic[]): Map<string, number[]> {
    const byThread = new Map<string, number[]>();
    const historyPath = path.join(this.baseDir, 'history.jsonl');
    if (!fs.existsSync(historyPath)) {
      return byThread;
    }
    let text: string;
    try {
      text = fs.readFileSync(historyPath, 'utf8');
    } catch {
      diagnostics.push({
        provider: 'codex',
        filePath: historyPath,
        reason: 'Codex history file could not be read',
        severity: 'warning',
      });
      return byThread;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        const obj = JSON.parse(line) as { session_id?: string; ts?: number };
        if (obj.session_id && typeof obj.ts === 'number') {
          const list = byThread.get(obj.session_id) ?? [];
          list.push(obj.ts * 1000);
          byThread.set(obj.session_id, list);
        }
      } catch {
        diagnostics.push({
          provider: 'codex',
          filePath: historyPath,
          eventType: 'jsonl-line',
          reason: `malformed history line ${i + 1}`,
          severity: 'warning',
        });
      }
    }
    return byThread;
  }
}

interface ThreadTopology {
  readonly rootId: string;
  readonly parentId: string | undefined;
  readonly interfaceId: InterfaceId;
}

function buildInvocation(
  thread: ThreadRow,
  { rootId, parentId, interfaceId }: ThreadTopology,
  activity: { prompts: number[]; spans: WorkInterval[]; start: number; end: number },
  diagnostics: Diagnostic[],
): NormalizedInvocation {
  const nameEvents = resolveCodexNameEvents(
    thread,
    rootId,
    interfaceId,
    activity.start,
    diagnostics,
  );
  return {
    provider: 'codex',
    interfaceId,
    launchRootId: rootId,
    invocationId: thread.id,
    parentId,
    cwd: thread.cwd ?? undefined,
    isRoot: thread.id === rootId,
    promptsMs: activity.prompts,
    agentSpans: activity.spans,
    sessionNameEvents: thread.id === rootId ? nameEvents : undefined,
    hasApproximateNameHistory:
      thread.id === rootId ? nameEvents.length > 0 : undefined,
    startMs: activity.start,
    endMs: activity.end,
  };
}

/** The only rollout record fields the reader is allowed to inspect. */
interface RolloutLineFields {
  readonly timestamp?: string;
  readonly type?: string;
  readonly payloadType?: string;
  readonly turnTrigger?: string;
}

/**
 * Extracts the allowed structural fields from a parsed rollout record and
 * discards everything else (prompt, response, and tool content).
 */
function pickRolloutFields(value: unknown): RolloutLineFields {
  if (typeof value !== 'object' || value === null) {
    throw new Error('rollout record is not an object');
  }
  const record = value as Record<string, unknown>;
  const payload =
    typeof record.payload === 'object' && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : undefined;
  const attribution =
    payload &&
    typeof payload.turn_attribution === 'object' &&
    payload.turn_attribution !== null
      ? (payload.turn_attribution as Record<string, unknown>)
      : undefined;
  return {
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
    payloadType: typeof payload?.type === 'string' ? payload.type : undefined,
    turnTrigger:
      typeof attribution?.turn_trigger === 'string'
        ? attribution.turn_trigger
        : undefined,
  };
}

function resolveCodexNameEvents(
  thread: ThreadRow,
  rootId: string,
  interfaceId: InterfaceId,
  startMs: number,
  diagnostics: Diagnostic[],
): SessionNameEvent[] {
  if (thread.id !== rootId) {
    return [];
  }
  const explicitName = normalizePersistedLabel(thread.name);
  const generatedTitle = normalizePersistedLabel(thread.title);
  if (thread.name !== undefined && thread.name !== null && typeof thread.name !== 'string') {
    diagnostics.push({
      provider: 'codex',
      interfaceId,
      sessionId: thread.id,
      eventType: 'thread-metadata',
      reason: 'explicit session name metadata had an unsupported type',
      severity: 'error',
    });
  }
  if (thread.name !== undefined && thread.name !== null && explicitName === undefined) {
    if (typeof thread.name === 'string') {
      diagnostics.push({
        provider: 'codex',
        interfaceId,
        sessionId: thread.id,
        eventType: 'thread-metadata',
        reason: 'explicit session name metadata was empty or whitespace',
        severity: 'warning',
      });
    }
  }
  if (thread.title !== undefined && thread.title !== null && typeof thread.title !== 'string') {
    diagnostics.push({
      provider: 'codex',
      interfaceId,
      sessionId: thread.id,
      eventType: 'thread-metadata',
      reason: 'generated session title metadata had an unsupported type',
      severity: 'error',
    });
  }
  if (thread.title !== undefined && thread.title !== null && generatedTitle === undefined) {
    if (typeof thread.title === 'string') {
      diagnostics.push({
        provider: 'codex',
        interfaceId,
        sessionId: thread.id,
        eventType: 'thread-metadata',
        reason: 'generated session title metadata was empty or whitespace',
        severity: 'warning',
      });
    }
  }
  const selectedName = explicitName ?? generatedTitle;
  if (selectedName === undefined) {
    return [];
  }
  diagnostics.push({
    provider: 'codex',
    interfaceId,
    sessionId: thread.id,
    eventType: 'thread-metadata',
    timestampMs: startMs,
    reason:
      'session naming history unavailable; applying latest persisted label to full launch',
    severity: 'warning',
  });
  return [{ timestampMs: startMs, name: selectedName }];
}

function normalizePersistedLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/** Follows spawn edges to the top-most ancestor thread id. */
export function resolveRoot(
  id: string,
  parentOf: Map<string, string>,
): string {
  const seen = new Set<string>();
  let current = id;
  while (parentOf.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parentOf.get(current) as string;
  }
  return current;
}
