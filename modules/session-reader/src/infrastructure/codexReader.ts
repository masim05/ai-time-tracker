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
  name?: string | null;
}

const DEFAULT_IDLE_GAP_MS = 2 * 60 * 1000;

/**
 * Reads Codex CLI and Codex App sessions from the shared `~/.codex` backend:
 * `state_5.sqlite` (threads + spawn edges), `logs_2.sqlite` (per-thread activity
 * and app detection), and `history.jsonl` (human prompt timestamps).
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
        threads = state
          .prepare(
            'SELECT id, created_at_ms, updated_at_ms, cwd, thread_source, name FROM threads',
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

      const logTimestamps = logInfo.timestampsByThread.get(thread.id) ?? [];
      const spans: WorkInterval[] =
        logTimestamps.length > 0
          ? clusterTimestamps(logTimestamps, this.idleGapMs)
          : [{ startMs: thread.created_at_ms, endMs: thread.updated_at_ms ?? thread.created_at_ms }];

      const start = Math.min(
        thread.created_at_ms,
        ...spans.map((s) => s.startMs),
      );
      const end = Math.max(
        thread.updated_at_ms ?? thread.created_at_ms,
        ...spans.map((s) => s.endMs),
      );

      const prompts =
        thread.thread_source === 'subagent'
          ? []
          : promptsByThread.get(thread.id) ?? [];

      const nameEvents = resolveCodexNameEvents(
        thread,
        rootId,
        interfaceId,
        start,
        diagnostics,
      );
      invocations.push({
        provider: 'codex',
        interfaceId,
        launchRootId: rootId,
        invocationId: thread.id,
        parentId,
        cwd: thread.cwd ?? undefined,
        isRoot: thread.id === rootId,
        promptsMs: prompts,
        agentSpans: spans,
        sessionNameEvents: thread.id === rootId ? nameEvents : undefined,
        hasApproximateNameHistory:
          thread.id === rootId ? nameEvents.length > 0 : undefined,
        startMs: start,
        endMs: end,
      });
    }

    return { invocations, diagnostics };
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
  if (thread.name === undefined || thread.name === null) {
    return [];
  }
  if (thread.name.trim().length === 0) {
    diagnostics.push({
      provider: 'codex',
      interfaceId,
      sessionId: thread.id,
      eventType: 'thread-metadata',
      reason: 'explicit session name metadata was empty or whitespace',
      severity: 'warning',
    });
    return [];
  }
  diagnostics.push({
    provider: 'codex',
    interfaceId,
    sessionId: thread.id,
    eventType: 'thread-metadata',
    timestampMs: startMs,
    reason:
      'session rename history unavailable; applying latest explicit name to full launch',
    severity: 'warning',
  });
  return [{ timestampMs: startMs, name: thread.name }];
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
