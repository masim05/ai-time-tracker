import * as fs from 'fs';
import * as path from 'path';
import { ISessionReader } from '../application/ports';
import {
  Diagnostic,
  NormalizedInvocation,
  ReadResult,
  WorkInterval,
} from '../domain/models';

/** Options for {@link CopilotCliReader}, allowing fixture directories in tests. */
export interface CopilotCliReaderOptions {
  /** Base `.copilot` directory. Defaults to `~/.copilot`. */
  readonly baseDir: string;
  /** Clock for active-session recency checks. Defaults to `Date.now`. */
  readonly nowMs?: () => number;
}

interface RawEvent {
  type?: string;
  timestamp?: string;
  agentId?: string | null;
  data?: Record<string, unknown>;
}

/**
 * A session with an in-use lock is only treated as active when its last event
 * is within this window of now; this avoids stale locks inflating `elapsed`.
 */
const ACTIVE_RECENCY_MS = 10 * 60 * 1000;

/**
 * Reads Copilot CLI sessions from `<base>/session-state/<uuid>/events.jsonl`,
 * using `workspace.yaml` for the working directory. All file access is
 * read-only. Malformed records are skipped and surfaced as diagnostics.
 */
export class CopilotCliReader implements ISessionReader {
  private readonly baseDir: string;
  private readonly nowMs: () => number;

  constructor(options: CopilotCliReaderOptions) {
    this.baseDir = options.baseDir;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  read(): ReadResult {
    const invocations: NormalizedInvocation[] = [];
    const diagnostics: Diagnostic[] = [];
    const sessionRoot = path.join(this.baseDir, 'session-state');

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(sessionRoot, { withFileTypes: true });
    } catch {
      // No Copilot sessions on this machine — not an error.
      return { invocations, diagnostics };
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const dir = path.join(sessionRoot, entry.name);
      const eventsPath = path.join(dir, 'events.jsonl');
      if (!fs.existsSync(eventsPath)) {
        continue;
      }
      this.readSession(entry.name, dir, eventsPath, invocations, diagnostics);
    }

    return { invocations, diagnostics };
  }

  private readSession(
    sessionId: string,
    dir: string,
    eventsPath: string,
    out: NormalizedInvocation[],
    diagnostics: Diagnostic[],
  ): void {
    const cwd = this.readCwd(dir);
    let content: string;
    try {
      content = fs.readFileSync(eventsPath, 'utf8');
    } catch {
      diagnostics.push({
        provider: 'copilot',
        interfaceId: 'copilot-cli',
        sessionId,
        filePath: eventsPath,
        reason: 'events.jsonl could not be read',
        severity: 'error',
      });
      return;
    }

    const events: RawEvent[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        events.push(JSON.parse(line) as RawEvent);
      } catch {
        diagnostics.push({
          provider: 'copilot',
          interfaceId: 'copilot-cli',
          sessionId,
          filePath: eventsPath,
          eventType: 'jsonl-line',
          reason: `malformed JSON at line ${i + 1}`,
          severity: 'error',
        });
      }
    }

    if (events.length === 0) {
      return;
    }

    const hasLock = this.hasLock(dir);
    this.buildInvocations(sessionId, cwd, events, hasLock, out);
  }

  /** Reconstructs root + sub-agent invocations from the event stream. */
  private buildInvocations(
    sessionId: string,
    cwd: string | undefined,
    events: RawEvent[],
    hasLock: boolean,
    out: NormalizedInvocation[],
  ): void {
    const tsOf = (e: RawEvent): number | null => {
      if (!e.timestamp) {
        return null;
      }
      const ms = Date.parse(e.timestamp);
      return Number.isNaN(ms) ? null : ms;
    };

    let minTs = Number.POSITIVE_INFINITY;
    let maxTs = Number.NEGATIVE_INFINITY;
    const promptsMs: number[] = [];

    // Open main-agent turns keyed by turnId -> start ts.
    const openTurns = new Map<string, number>();
    const mainSpans: WorkInterval[] = [];
    // Sub-agent spans keyed by agentId (tool call id).
    const subOpen = new Map<string, number>();
    const subSpans = new Map<string, WorkInterval[]>();
    let lastAbortTs: number | null = null;

    const closeAllOpen = (endTs: number): void => {
      for (const start of openTurns.values()) {
        mainSpans.push({ startMs: start, endMs: endTs });
      }
      openTurns.clear();
      for (const [agentId, start] of subOpen.entries()) {
        const list = subSpans.get(agentId) ?? [];
        list.push({ startMs: start, endMs: endTs });
        subSpans.set(agentId, list);
        subOpen.delete(agentId);
      }
    };

    for (const e of events) {
      const ts = tsOf(e);
      if (ts === null) {
        continue;
      }
      minTs = Math.min(minTs, ts);
      maxTs = Math.max(maxTs, ts);
      const isSub = typeof e.agentId === 'string' && e.agentId.length > 0;

      switch (e.type) {
        case 'user.message': {
          const parentTask = e.data?.['parentAgentTaskId'];
          if (!isSub && !parentTask) {
            promptsMs.push(ts);
          }
          break;
        }
        case 'assistant.turn_start': {
          const turnId = String(e.data?.['turnId'] ?? `${ts}`);
          if (isSub) {
            const agentId = e.agentId as string;
            if (!subOpen.has(agentId)) {
              subOpen.set(agentId, ts);
            }
          } else {
            openTurns.set(turnId, ts);
          }
          break;
        }
        case 'assistant.turn_end': {
          const turnId = String(e.data?.['turnId'] ?? '');
          if (isSub) {
            break;
          }
          const start = openTurns.get(turnId);
          if (start !== undefined) {
            mainSpans.push({ startMs: start, endMs: ts });
            openTurns.delete(turnId);
          }
          break;
        }
        case 'subagent.started': {
          const agentId = String(e.agentId ?? e.data?.['toolCallId'] ?? '');
          if (agentId) {
            subOpen.set(agentId, ts);
          }
          break;
        }
        case 'subagent.completed': {
          const agentId = String(e.agentId ?? e.data?.['toolCallId'] ?? '');
          const start = subOpen.get(agentId);
          if (start !== undefined) {
            const list = subSpans.get(agentId) ?? [];
            list.push({ startMs: start, endMs: ts });
            subSpans.set(agentId, list);
            subOpen.delete(agentId);
          }
          break;
        }
        case 'abort': {
          lastAbortTs = ts;
          // Cancellation counts through the abort timestamp.
          closeAllOpen(ts);
          break;
        }
        default:
          break;
      }
    }

    if (!Number.isFinite(minTs)) {
      return;
    }

    const active = hasLock && this.nowMs() - maxTs < ACTIVE_RECENCY_MS;
    const endTs = active ? null : maxTs;
    const closeTs = lastAbortTs !== null ? Math.max(lastAbortTs, maxTs) : maxTs;
    closeAllOpen(closeTs);

    out.push({
      provider: 'copilot',
      interfaceId: 'copilot-cli',
      launchRootId: sessionId,
      invocationId: sessionId,
      cwd,
      isRoot: true,
      promptsMs,
      agentSpans: mainSpans,
      startMs: minTs,
      endMs: endTs,
    });

    let subIndex = 0;
    for (const [agentId, spans] of subSpans.entries()) {
      if (spans.length === 0) {
        continue;
      }
      const start = Math.min(...spans.map((s) => s.startMs));
      const end = Math.max(...spans.map((s) => s.endMs));
      out.push({
        provider: 'copilot',
        interfaceId: 'copilot-cli',
        launchRootId: sessionId,
        invocationId: `${sessionId}::sub::${agentId || subIndex}`,
        parentId: sessionId,
        cwd,
        isRoot: false,
        promptsMs: [],
        agentSpans: spans,
        startMs: start,
        endMs: active ? null : end,
      });
      subIndex++;
    }
  }

  private readCwd(dir: string): string | undefined {
    const yamlPath = path.join(dir, 'workspace.yaml');
    try {
      const text = fs.readFileSync(yamlPath, 'utf8');
      return parseWorkspaceCwd(text);
    } catch {
      return undefined;
    }
  }

  private hasLock(dir: string): boolean {
    try {
      return fs
        .readdirSync(dir)
        .some((name) => name.startsWith('inuse.') && name.endsWith('.lock'));
    } catch {
      return false;
    }
  }
}

/** Extracts the `cwd` value from a Copilot `workspace.yaml` (flat key: value). */
export function parseWorkspaceCwd(text: string): string | undefined {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const match = /^cwd:\s*(.+?)\s*$/.exec(line);
    if (match) {
      let value = match[1];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value || undefined;
    }
  }
  return undefined;
}
