import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { CodexReader, resolveRoot } from './codexReader';
import { NormalizedInvocation } from '../domain/models';

let baseDir: string;

beforeAll(() => {
  baseDir = fs.mkdtempSync(path.join(__dirname, 'codex-fixture-'));

  const state = new Database(path.join(baseDir, 'state_5.sqlite'));
  state.exec(`
    CREATE TABLE threads (
      id TEXT, created_at_ms INTEGER, updated_at_ms INTEGER, cwd TEXT,
      thread_source TEXT, name TEXT, title TEXT, rollout_path TEXT
    );
    CREATE TABLE thread_spawn_edges (
      parent_thread_id TEXT, child_thread_id TEXT, status TEXT
    );
  `);
  const insThread = state.prepare(
    'INSERT INTO threads (id, created_at_ms, updated_at_ms, cwd, thread_source, name, title) VALUES (?,?,?,?,?,?,?)',
  );
  // Root CLI thread.
  insThread.run('T-root', 1000, 500000, '/home/dev/app', 'user', '  codex-work  ', 'ignored title');
  // Sub-agent thread under the root, in the same dir.
  insThread.run('T-sub', 5000, 400000, '/home/dev/app', 'subagent', null, 'ignored sub title');
  // Independent app thread.
  insThread.run('T-app', 2000, 600000, '/home/dev/app2', 'user', null, '  generated app title  ');
  // App thread with both explicit and generated labels.
  insThread.run('T-app-explicit', 2500, 650000, '/home/dev/app2', 'user', ' app name ', 'ignored app title');
  // CLI thread with an empty explicit name and a generated-title fallback.
  insThread.run('T-title', 3000, 700000, '/home/dev/app3', 'user', '   ', 'generated CLI title');
  // Unnamed root whose history text resembles a rename request.
  insThread.run('T-unnamed', 4000, 800000, '/home/dev/app4', 'user', null, null);
  // Malformed provider metadata must not abort other sessions.
  insThread.run(
    'T-malformed',
    4500,
    850000,
    '/home/dev/app5',
    'user',
    null,
    Buffer.from([42]),
  );
  // An unsupported explicit-name type is malformed even when title fallback works.
  insThread.run(
    'T-malformed-name',
    4750,
    875000,
    '/home/dev/app6',
    'user',
    Buffer.from([43]),
    'generated fallback title',
  );
  state
    .prepare(
      'INSERT INTO thread_spawn_edges (parent_thread_id, child_thread_id, status) VALUES (?,?,?)',
    )
    .run('T-root', 'T-sub', 'done');
  state.close();

  const logs = new Database(path.join(baseDir, 'logs_2.sqlite'));
  logs.exec(`
    CREATE TABLE logs (
      id INTEGER PRIMARY KEY, ts INTEGER, ts_nanos INTEGER, level TEXT,
      target TEXT, thread_id TEXT, process_uuid TEXT
    );
  `);
  const insLog = logs.prepare(
    'INSERT INTO logs (ts, ts_nanos, level, target, thread_id, process_uuid) VALUES (?,?,?,?,?,?)',
  );
  // Root thread activity in process P1 (CLI).
  insLog.run(1, 0, 'INFO', 'codex_core::turn', 'T-root', 'P1');
  insLog.run(2, 0, 'INFO', 'codex_core::turn', 'T-root', 'P1');
  // Sub-agent thread activity in process P1.
  insLog.run(5, 0, 'INFO', 'codex_core::turn', 'T-sub', 'P1');
  // App thread activity in process P2, which also emits app-server logs.
  insLog.run(2, 0, 'INFO', 'codex_core::turn', 'T-app', 'P2');
  insLog.run(3, 0, 'INFO', 'codex_app_server::outgoing_message', 'T-app', 'P2');
  insLog.run(2, 500000000, 'INFO', 'codex_core::turn', 'T-app-explicit', 'P5');
  insLog.run(3, 500000000, 'INFO', 'codex_app_server::outgoing_message', 'T-app-explicit', 'P5');
  insLog.run(3, 0, 'INFO', 'codex_core::turn', 'T-title', 'P3');
  insLog.run(4, 0, 'INFO', 'codex_core::turn', 'T-unnamed', 'P4');
  insLog.run(4, 500000000, 'INFO', 'codex_core::turn', 'T-malformed', 'P6');
  insLog.run(4, 750000000, 'INFO', 'codex_core::turn', 'T-malformed-name', 'P7');
  logs.close();

  fs.writeFileSync(
    path.join(baseDir, 'history.jsonl'),
    [
      JSON.stringify({ session_id: 'T-root', ts: 1, text: '' }),
      JSON.stringify({ session_id: 'T-unnamed', ts: 4, text: "call this session 'abc'" }),
    ].join('\n') + '\n',
  );
});

afterAll(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
});

describe('resolveRoot', () => {
  it('follows spawn edges to the top-most ancestor', () => {
    const parentOf = new Map([
      ['c', 'b'],
      ['b', 'a'],
    ]);
    expect(resolveRoot('c', parentOf)).toBe('a');
    expect(resolveRoot('a', parentOf)).toBe('a');
  });
});

describe('CodexReader', () => {
  function read() {
    return new CodexReader({ baseDir, idleGapMs: 60_000 }).read();
  }

  it('builds a root thread invocation with history prompts', () => {
    const { invocations } = read();
    const root = invocations.find(
      (i) => i.invocationId === 'T-root',
    ) as NormalizedInvocation;
    expect(root.interfaceId).toBe('codex-cli');
    expect(root.isRoot).toBe(true);
    expect(root.launchRootId).toBe('T-root');
    expect(root.promptsMs).toEqual([1000]);
    expect(root.sessionNameEvents).toEqual([
      { timestampMs: 1000, name: 'codex-work' },
    ]);
    expect(root.hasApproximateNameHistory).toBe(true);
  });

  it('reconstructs the sub-agent DAG under the root launch', () => {
    const { invocations } = read();
    const sub = invocations.find(
      (i) => i.invocationId === 'T-sub',
    ) as NormalizedInvocation;
    expect(sub.parentId).toBe('T-root');
    expect(sub.launchRootId).toBe('T-root');
    expect(sub.promptsMs).toEqual([]);
  });

  it('classifies app-server threads as codex-app', () => {
    const { invocations } = read();
    const app = invocations.find(
      (i) => i.invocationId === 'T-app',
    ) as NormalizedInvocation;
    expect(app.interfaceId).toBe('codex-app');
    expect(app.sessionNameEvents).toEqual([
      { timestampMs: 2000, name: 'generated app title' },
    ]);
    expect(app.hasApproximateNameHistory).toBe(true);
  });

  it('extracts and trims an explicit name for a codex-app root', () => {
    const { invocations } = read();
    const app = invocations.find(
      (i) => i.invocationId === 'T-app-explicit',
    ) as NormalizedInvocation;
    expect(app.interfaceId).toBe('codex-app');
    expect(app.sessionNameEvents).toEqual([
      { timestampMs: 2500, name: 'app name' },
    ]);
  });

  it('uses a generated CLI title when the explicit name is blank', () => {
    const { invocations, diagnostics } = read();
    const titled = invocations.find(
      (i) => i.invocationId === 'T-title',
    ) as NormalizedInvocation;
    expect(titled.interfaceId).toBe('codex-cli');
    expect(titled.sessionNameEvents).toEqual([
      { timestampMs: 3000, name: 'generated CLI title' },
    ]);
    expect(titled.hasApproximateNameHistory).toBe(true);
    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.sessionId === 'T-title' &&
          diagnostic.reason === 'explicit session name metadata was empty or whitespace',
      ),
    ).toBe(true);
  });

  it('prefers and trims an explicit name when a generated title also exists', () => {
    const { invocations } = read();
    const root = invocations.find(
      (i) => i.invocationId === 'T-root',
    ) as NormalizedInvocation;
    expect(root.sessionNameEvents).toEqual([
      { timestampMs: 1000, name: 'codex-work' },
    ]);
  });

  it('does not infer a name from ordinary history messages', () => {
    const { invocations } = read();
    const unnamed = invocations.find(
      (i) => i.invocationId === 'T-unnamed',
    ) as NormalizedInvocation;
    expect(unnamed.sessionNameEvents).toEqual([]);
    expect(unnamed.hasApproximateNameHistory).toBe(false);
  });

  it('reports unsupported generated-title metadata as an error without exposing its value', () => {
    const { invocations, diagnostics } = read();
    const malformed = invocations.find(
      (i) => i.invocationId === 'T-malformed',
    ) as NormalizedInvocation;
    expect(malformed.sessionNameEvents).toEqual([]);
    const diagnostic = diagnostics.find(
      (item) =>
        item.sessionId === 'T-malformed' &&
        item.reason === 'generated session title metadata had an unsupported type',
    );
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.reason).not.toContain('42');
  });

  it('reports unsupported explicit-name metadata as an error while preserving title fallback', () => {
    const { invocations, diagnostics } = read();
    const malformed = invocations.find(
      (i) => i.invocationId === 'T-malformed-name',
    ) as NormalizedInvocation;
    expect(malformed.sessionNameEvents).toEqual([
      { timestampMs: 4750, name: 'generated fallback title' },
    ]);
    const diagnostic = diagnostics.find(
      (item) =>
        item.sessionId === 'T-malformed-name' &&
        item.reason === 'explicit session name metadata had an unsupported type',
    );
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.reason).not.toContain('43');
  });

  it('derives agent spans from clustered log timestamps', () => {
    const { invocations } = read();
    const root = invocations.find(
      (i) => i.invocationId === 'T-root',
    ) as NormalizedInvocation;
    // Logs at ts=1s and ts=2s cluster into one span.
    expect(root.agentSpans).toContainEqual({ startMs: 1000, endMs: 2000 });
  });

  it('warns and returns no data when the state database is missing', () => {
    const result = new CodexReader({ baseDir: '/nonexistent/codex' }).read();
    expect(result.invocations).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.severity === 'warning')).toBe(true);
  });

  it('reports an error when the state database is corrupt', () => {
    const corrupt = fs.mkdtempSync(path.join(__dirname, 'codex-corrupt-'));
    fs.writeFileSync(path.join(corrupt, 'state_5.sqlite'), 'not a database');
    const result = new CodexReader({ baseDir: corrupt }).read();
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    fs.rmSync(corrupt, { recursive: true, force: true });
  });

  it('warns when latest-only name fallback is used', () => {
    const { diagnostics } = read();
    expect(
      diagnostics.some((d) =>
        d.reason.includes('session naming history unavailable'),
      ),
    ).toBe(true);
  });

  it('supports an older threads schema without a title column', () => {
    const oldSchemaDir = fs.mkdtempSync(path.join(__dirname, 'codex-old-schema-'));
    const state = new Database(path.join(oldSchemaDir, 'state_5.sqlite'));
    state.exec(`
      CREATE TABLE threads (
        id TEXT, created_at_ms INTEGER, updated_at_ms INTEGER, cwd TEXT,
        thread_source TEXT, name TEXT
      );
      CREATE TABLE thread_spawn_edges (
        parent_thread_id TEXT, child_thread_id TEXT, status TEXT
      );
      INSERT INTO threads VALUES ('old-root', 1000, 2000, '/tmp/old', 'user', 'old name');
    `);
    state.close();

    const result = new CodexReader({ baseDir: oldSchemaDir }).read();
    expect(result.invocations).toHaveLength(1);
    expect(result.invocations[0]?.sessionNameEvents).toEqual([
      { timestampMs: 1000, name: 'old name' },
    ]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(false);
    fs.rmSync(oldSchemaDir, { recursive: true, force: true });
  });
});

/** Sanitized rollout record: only the fields the reader may inspect. */
type RolloutRecord =
  | { timestamp?: string; type: string; payload?: Record<string, unknown> }
  | string;

interface FixtureThread {
  id: string;
  createdAtMs: number;
  updatedAtMs: number;
  source?: string;
  /** Rollout records, a raw path (`{ path }`), or null for no rollout. */
  rollout?: RolloutRecord[] | { path: string } | null;
}

interface FixtureOptions {
  threads: FixtureThread[];
  edges?: [string, string][];
  /** Log timestamps per thread in epoch ms. */
  logs?: Record<string, number[]>;
  history?: { session_id: string; ts: number; text?: string }[];
  withRolloutColumn?: boolean;
  /** Contents of `external_agent_session_imports.json`: an object or raw text. */
  imports?: unknown;
}

const fixtureDirs: string[] = [];

afterAll(() => {
  for (const dir of fixtureDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function started(ms: number, trigger?: string): RolloutRecord {
  return {
    timestamp: iso(ms),
    type: 'event_msg',
    payload:
      trigger === undefined
        ? { type: 'task_started' }
        : { type: 'task_started', turn_attribution: { turn_trigger: trigger } },
  };
}

function completed(ms: number): RolloutRecord {
  return { timestamp: iso(ms), type: 'event_msg', payload: { type: 'task_complete' } };
}

function aborted(ms: number): RolloutRecord {
  return { timestamp: iso(ms), type: 'event_msg', payload: { type: 'turn_aborted' } };
}

function userMessage(ms: number): RolloutRecord {
  return {
    timestamp: iso(ms),
    type: 'event_msg',
    payload: { type: 'user_message', message: 'SECRET-PROMPT-TEXT' },
  };
}

function other(ms: number, type = 'response_item'): RolloutRecord {
  return {
    timestamp: iso(ms),
    type,
    payload: { type: 'message', content: 'SECRET-RESPONSE-TEXT' },
  };
}

function buildCodexDir(options: FixtureOptions): string {
  const dir = fs.mkdtempSync(path.join(__dirname, 'codex-rollout-'));
  fixtureDirs.push(dir);
  const withRollout = options.withRolloutColumn ?? true;
  const state = new Database(path.join(dir, 'state_5.sqlite'));
  state.exec(`
    CREATE TABLE threads (
      id TEXT, created_at_ms INTEGER, updated_at_ms INTEGER, cwd TEXT,
      thread_source TEXT, name TEXT, title TEXT${withRollout ? ', rollout_path TEXT' : ''}
    );
    CREATE TABLE thread_spawn_edges (
      parent_thread_id TEXT, child_thread_id TEXT, status TEXT
    );
  `);
  for (const thread of options.threads) {
    let rolloutPath: string | null = null;
    if (thread.rollout && 'path' in thread.rollout) {
      rolloutPath = thread.rollout.path;
    } else if (Array.isArray(thread.rollout)) {
      rolloutPath = path.join(dir, `rollout-${thread.id}.jsonl`);
      fs.writeFileSync(
        rolloutPath,
        thread.rollout
          .map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))
          .join('\n') + '\n',
      );
    }
    const values = [
      thread.id,
      thread.createdAtMs,
      thread.updatedAtMs,
      '/home/dev/rollout',
      thread.source ?? 'user',
      null,
      null,
    ];
    if (withRollout) {
      state
        .prepare('INSERT INTO threads VALUES (?,?,?,?,?,?,?,?)')
        .run(...values, rolloutPath);
    } else {
      state.prepare('INSERT INTO threads VALUES (?,?,?,?,?,?,?)').run(...values);
    }
  }
  for (const [parent, child] of options.edges ?? []) {
    state
      .prepare('INSERT INTO thread_spawn_edges VALUES (?,?,?)')
      .run(parent, child, 'done');
  }
  state.close();

  const logs = new Database(path.join(dir, 'logs_2.sqlite'));
  logs.exec(`
    CREATE TABLE logs (
      id INTEGER PRIMARY KEY, ts INTEGER, ts_nanos INTEGER, level TEXT,
      target TEXT, thread_id TEXT, process_uuid TEXT
    );
  `);
  const insLog = logs.prepare(
    'INSERT INTO logs (ts, ts_nanos, level, target, thread_id, process_uuid) VALUES (?,?,?,?,?,?)',
  );
  for (const [threadId, stamps] of Object.entries(options.logs ?? {})) {
    for (const ms of stamps) {
      insLog.run(
        Math.floor(ms / 1000),
        (ms % 1000) * 1_000_000,
        'INFO',
        'codex_core::turn',
        threadId,
        'P-rollout',
      );
    }
  }
  logs.close();

  if (options.imports !== undefined) {
    fs.writeFileSync(
      path.join(dir, 'external_agent_session_imports.json'),
      typeof options.imports === 'string'
        ? options.imports
        : JSON.stringify(options.imports),
    );
  }
  if (options.history) {
    fs.writeFileSync(
      path.join(dir, 'history.jsonl'),
      options.history.map((h) => JSON.stringify(h)).join('\n') + '\n',
    );
  }
  return dir;
}

function readThread(dir: string, id: string) {
  const result = new CodexReader({ baseDir: dir }).read();
  const invocation = result.invocations.find(
    (i) => i.invocationId === id,
  ) as NormalizedInvocation;
  return { invocation, diagnostics: result.diagnostics };
}

// Sanitized timings modelled on the issue #17 two-turn Codex App thread.
const T0 = Date.UTC(2026, 9, 31, 5, 29, 50, 0);
const SEC = 1000;

describe('CodexReader rollout-based activity', () => {
  it('derives agent spans and prompts from rollout turns, not whole-thread logs (regression #17)', () => {
    const logStamps: number[] = [];
    for (let t = T0; t <= T0 + 59 * SEC; t += 5 * SEC) {
      logStamps.push(t);
    }
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-turns',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            { timestamp: iso(T0 + 26_729), type: 'session_meta', payload: { type: 'x' } },
            started(T0 + 26_733, 'user'),
            other(T0 + 27_034, 'turn_context'),
            other(T0 + 28_000),
            completed(T0 + 29_963),
            started(T0 + 54_405, 'user'),
            other(T0 + 56_000),
            completed(T0 + 59_241),
          ],
        },
      ],
      logs: { 'T-turns': logStamps },
    });
    const { invocation, diagnostics } = readThread(dir, 'T-turns');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 26_733, endMs: T0 + 29_963 },
      { startMs: T0 + 54_405, endMs: T0 + 59_241 },
    ]);
    expect(invocation.promptsMs).toEqual([T0 + 26_733, T0 + 54_405]);
    // Start and end still follow the thread and its log activity.
    expect(invocation.startMs).toBe(T0);
    expect(invocation.endMs).toBe(T0 + 60 * SEC);
    expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
  });

  it('ends a turn on turn_aborted', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-abort',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            started(T0 + 1 * SEC, 'user'),
            aborted(T0 + 4 * SEC),
            started(T0 + 10 * SEC, 'user'),
            completed(T0 + 12 * SEC),
          ],
        },
      ],
    });
    const { invocation } = readThread(dir, 'T-abort');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 4 * SEC },
      { startMs: T0 + 10 * SEC, endMs: T0 + 12 * SEC },
    ]);
  });

  it('ends an unterminated final turn at the last record timestamp', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-open',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            started(T0 + 1 * SEC, 'user'),
            completed(T0 + 2 * SEC),
            started(T0 + 5 * SEC, 'user'),
            other(T0 + 7 * SEC),
            other(T0 + 9 * SEC),
          ],
        },
      ],
    });
    const { invocation } = readThread(dir, 'T-open');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 2 * SEC },
      { startMs: T0 + 5 * SEC, endMs: T0 + 9 * SEC },
    ]);
  });

  it('ends an unterminated turn at updated_at when trailing records have no timestamp', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-open-untimed',
          createdAtMs: T0,
          updatedAtMs: T0 + 30 * SEC,
          rollout: [
            started(T0 + 5 * SEC, 'user'),
            { type: 'response_item', payload: { type: 'message' } },
          ],
        },
      ],
    });
    const { invocation } = readThread(dir, 'T-open-untimed');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 5 * SEC, endMs: T0 + 30 * SEC },
    ]);
  });

  it('counts only user-triggered turns as prompts', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-triggers',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            started(T0 + 1 * SEC, 'user'),
            userMessage(T0 + 1 * SEC + 5),
            completed(T0 + 2 * SEC),
            started(T0 + 5 * SEC, 'automation'),
            userMessage(T0 + 5 * SEC + 5),
            completed(T0 + 6 * SEC),
          ],
        },
      ],
    });
    const { invocation } = readThread(dir, 'T-triggers');
    expect(invocation.promptsMs).toEqual([T0 + 1 * SEC]);
    expect(invocation.agentSpans).toHaveLength(2);
  });

  it('uses user_message events as prompts for turns without turn_attribution', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-old-format',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            started(T0 + 1 * SEC),
            userMessage(T0 + 1 * SEC + 2),
            completed(T0 + 3 * SEC),
            started(T0 + 20 * SEC),
            userMessage(T0 + 20 * SEC + 2),
            completed(T0 + 25 * SEC),
            // Outside any turn: not a prompt.
            userMessage(T0 + 40 * SEC),
          ],
        },
      ],
      history: [{ session_id: 'T-old-format', ts: Math.floor(T0 / 1000) + 50 }],
    });
    const { invocation } = readThread(dir, 'T-old-format');
    expect(invocation.promptsMs).toEqual([T0 + 1 * SEC + 2, T0 + 20 * SEC + 2]);
  });

  it('falls back to log clustering and history prompts when the rollout has no turns', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-meta-only',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [{ timestamp: iso(T0), type: 'session_meta', payload: { type: 'x' } }],
        },
      ],
      logs: { 'T-meta-only': [T0 + 1 * SEC, T0 + 3 * SEC] },
      history: [{ session_id: 'T-meta-only', ts: Math.floor(T0 / 1000) + 1 }],
    });
    const { invocation } = readThread(dir, 'T-meta-only');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 3 * SEC },
    ]);
    expect(invocation.promptsMs).toEqual([T0 + 1 * SEC]);
  });

  it('falls back to history prompts when rollout turns yield no prompts', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-no-user-turns',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [started(T0 + 5 * SEC, 'automation'), completed(T0 + 6 * SEC)],
        },
      ],
      history: [{ session_id: 'T-no-user-turns', ts: Math.floor(T0 / 1000) + 4 }],
    });
    const { invocation } = readThread(dir, 'T-no-user-turns');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 5 * SEC, endMs: T0 + 6 * SEC },
    ]);
    expect(invocation.promptsMs).toEqual([T0 + 4 * SEC]);
  });

  it('falls back with a content-free warning when the rollout file is missing', () => {
    const missing = path.join(__dirname, 'no-such-dir', 'rollout-missing.jsonl');
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-missing',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: { path: missing },
        },
      ],
      logs: { 'T-missing': [T0 + 1 * SEC, T0 + 2 * SEC] },
      history: [{ session_id: 'T-missing', ts: Math.floor(T0 / 1000) + 1 }],
    });
    const { invocation, diagnostics } = readThread(dir, 'T-missing');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 2 * SEC },
    ]);
    expect(invocation.promptsMs).toEqual([T0 + 1 * SEC]);
    const warning = diagnostics.find(
      (d) => d.sessionId === 'T-missing' && d.filePath === missing,
    );
    expect(warning?.severity).toBe('warning');
    expect(warning?.reason).toBe('Codex rollout file not found');
  });

  it('skips malformed rollout lines with a content-free warning', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-malformed-rollout',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [
            started(T0 + 1 * SEC, 'user'),
            '{"type":"event_msg","payload":{"message":"SECRET-PROMPT-TEXT"',
            completed(T0 + 2 * SEC),
          ],
        },
      ],
    });
    const { invocation, diagnostics } = readThread(dir, 'T-malformed-rollout');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 2 * SEC },
    ]);
    const warning = diagnostics.find(
      (d) => d.sessionId === 'T-malformed-rollout' && d.eventType === 'jsonl-line',
    );
    expect(warning?.severity).toBe('warning');
    expect(warning?.reason).toBe('malformed rollout line 2');
    expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
  });

  it('keeps log clustering for a threads schema without rollout_path', () => {
    const dir = buildCodexDir({
      withRolloutColumn: false,
      threads: [{ id: 'T-no-column', createdAtMs: T0, updatedAtMs: T0 + 60 * SEC }],
      logs: { 'T-no-column': [T0 + 1 * SEC, T0 + 2 * SEC] },
      history: [{ session_id: 'T-no-column', ts: Math.floor(T0 / 1000) + 1 }],
    });
    const { invocation, diagnostics } = readThread(dir, 'T-no-column');
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 1 * SEC, endMs: T0 + 2 * SEC },
    ]);
    expect(invocation.promptsMs).toEqual([T0 + 1 * SEC]);
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
  });

  it('keeps sub-agent threads prompt-free while using their rollout spans', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-parent',
          createdAtMs: T0,
          updatedAtMs: T0 + 60 * SEC,
          rollout: [started(T0 + 1 * SEC, 'user'), completed(T0 + 30 * SEC)],
        },
        {
          id: 'T-child',
          createdAtMs: T0 + 2 * SEC,
          updatedAtMs: T0 + 20 * SEC,
          source: 'subagent',
          rollout: [started(T0 + 3 * SEC, 'user'), completed(T0 + 10 * SEC)],
        },
      ],
      edges: [['T-parent', 'T-child']],
    });
    const { invocation } = readThread(dir, 'T-child');
    expect(invocation.parentId).toBe('T-parent');
    expect(invocation.promptsMs).toEqual([]);
    expect(invocation.agentSpans).toEqual([
      { startMs: T0 + 3 * SEC, endMs: T0 + 10 * SEC },
    ]);
  });
});

// Import time and replay modelled on Codex App imports of external transcripts.
const IMPORTED_AT_S = Math.floor(T0 / 1000) + 3600;
const IMPORTED_AT_MS = IMPORTED_AT_S * 1000;

function importRecord(threadId: string, importedAt: unknown = IMPORTED_AT_S) {
  return {
    source_path: '/home/dev/.claude/projects/x/SECRET-SOURCE-PATH.jsonl',
    content_sha256: 'abc',
    imported_thread_id: threadId,
    imported_at: importedAt,
    source_modified_at: IMPORTED_AT_S - 10,
    title: 'SECRET-IMPORTED-TITLE',
  };
}

/** Replayed history: every turn event stamped within milliseconds of the import. */
function replay(baseMs: number): RolloutRecord[] {
  return [
    started(baseMs),
    userMessage(baseMs + 1),
    completed(baseMs + 2),
    started(baseMs + 3),
    userMessage(baseMs + 4),
    completed(baseMs + 5),
  ];
}

const nativeThread: FixtureThread = {
  id: 'T-native',
  createdAtMs: T0,
  updatedAtMs: T0 + 60 * SEC,
  rollout: [
    started(T0 + 1 * SEC, 'user'),
    completed(T0 + 3 * SEC),
    started(T0 + 20 * SEC, 'user'),
    completed(T0 + 25 * SEC),
  ],
};

function expectNativeUnchanged(invocations: readonly NormalizedInvocation[]) {
  const native = invocations.find((i) => i.invocationId === 'T-native');
  expect(native?.agentSpans).toEqual([
    { startMs: T0 + 1 * SEC, endMs: T0 + 3 * SEC },
    { startMs: T0 + 20 * SEC, endMs: T0 + 25 * SEC },
  ]);
  expect(native?.promptsMs).toEqual([T0 + 1 * SEC, T0 + 20 * SEC]);
  expect(native?.startMs).toBe(T0);
  expect(native?.endMs).toBe(T0 + 60 * SEC);
}

describe('CodexReader imported threads', () => {
  it('skips an imported thread that has only its import replay, with a counted content-free warning', () => {
    const dir = buildCodexDir({
      threads: [
        nativeThread,
        {
          id: 'T-imported',
          // Imported threads keep the external session's original creation time.
          createdAtMs: T0 - 86_400 * SEC,
          updatedAtMs: IMPORTED_AT_MS + 5 * SEC,
          rollout: [
            ...replay(IMPORTED_AT_MS - 400),
            // App metadata written later is not a turn.
            other(IMPORTED_AT_MS + 86_400 * SEC, 'event_msg'),
          ],
        },
        {
          id: 'T-imported-2',
          createdAtMs: T0 - 3 * 86_400 * SEC,
          updatedAtMs: T0 - 2 * 86_400 * SEC,
          rollout: replay(IMPORTED_AT_MS + 300),
        },
      ],
      logs: { 'T-imported': [IMPORTED_AT_MS, IMPORTED_AT_MS + 86_400 * SEC] },
      history: [{ session_id: 'T-imported', ts: IMPORTED_AT_S + 7200 }],
      imports: {
        records: [importRecord('T-imported'), importRecord('T-imported-2')],
        detected_connector_records: [],
      },
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expect(invocations.map((i) => i.invocationId)).toEqual(['T-native']);
    expectNativeUnchanged(invocations);
    const skipped = diagnostics.filter((d) => d.reason.includes('imported'));
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.severity).toBe('warning');
    expect(skipped[0]?.reason).toMatch(/^2 Codex thread\(s\) skipped: /);
    expect(skipped[0]?.filePath).toBe(
      path.join(dir, 'external_agent_session_imports.json'),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
  });

  it('reports only post-import turns of an imported thread, with start and end taken from them', () => {
    const dir = buildCodexDir({
      threads: [
        nativeThread,
        {
          id: 'T-continued',
          createdAtMs: T0 - 86_400 * SEC,
          updatedAtMs: IMPORTED_AT_MS + 7200 * SEC,
          rollout: [
            ...replay(IMPORTED_AT_MS - 400),
            started(IMPORTED_AT_MS + 3600 * SEC, 'user'),
            completed(IMPORTED_AT_MS + 3610 * SEC),
            started(IMPORTED_AT_MS + 3700 * SEC, 'user'),
            completed(IMPORTED_AT_MS + 3730 * SEC),
          ],
        },
      ],
      logs: { 'T-continued': [T0 - 86_400 * SEC, IMPORTED_AT_MS + 7200 * SEC] },
      imports: { records: [importRecord('T-continued')] },
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expectNativeUnchanged(invocations);
    const continued = invocations.find((i) => i.invocationId === 'T-continued');
    expect(continued?.agentSpans).toEqual([
      { startMs: IMPORTED_AT_MS + 3600 * SEC, endMs: IMPORTED_AT_MS + 3610 * SEC },
      { startMs: IMPORTED_AT_MS + 3700 * SEC, endMs: IMPORTED_AT_MS + 3730 * SEC },
    ]);
    expect(continued?.promptsMs).toEqual([
      IMPORTED_AT_MS + 3600 * SEC,
      IMPORTED_AT_MS + 3700 * SEC,
    ]);
    expect(continued?.startMs).toBe(IMPORTED_AT_MS + 3600 * SEC);
    expect(continued?.endMs).toBe(IMPORTED_AT_MS + 3730 * SEC);
    expect(diagnostics.some((d) => d.reason.includes('skipped'))).toBe(false);
  });

  it('treats turn events up to the replay tolerance after imported_at as replay', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-boundary',
          createdAtMs: T0,
          updatedAtMs: IMPORTED_AT_MS + 120 * SEC,
          rollout: [
            started(IMPORTED_AT_MS + 60 * SEC, 'user'),
            completed(IMPORTED_AT_MS + 60 * SEC + 1),
            started(IMPORTED_AT_MS + 60 * SEC + 1, 'user'),
            completed(IMPORTED_AT_MS + 70 * SEC),
          ],
        },
      ],
      imports: { records: [importRecord('T-boundary')] },
    });
    const { invocation } = readThread(dir, 'T-boundary');
    expect(invocation.agentSpans).toEqual([
      { startMs: IMPORTED_AT_MS + 60 * SEC + 1, endMs: IMPORTED_AT_MS + 70 * SEC },
    ]);
    expect(invocation.promptsMs).toEqual([IMPORTED_AT_MS + 60 * SEC + 1]);
  });

  it('skips an imported thread whose record has no usable imported_at', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-no-time',
          createdAtMs: T0,
          updatedAtMs: IMPORTED_AT_MS + 7200 * SEC,
          rollout: [
            started(IMPORTED_AT_MS + 3600 * SEC, 'user'),
            completed(IMPORTED_AT_MS + 3610 * SEC),
          ],
        },
      ],
      imports: { records: [importRecord('T-no-time', 'yesterday')] },
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expect(invocations).toHaveLength(0);
    expect(diagnostics.some((d) => /^1 Codex thread\(s\) skipped: /.test(d.reason))).toBe(true);
  });

  const LATER_IMPORT_S = IMPORTED_AT_S + 7200;

  function reimportedThread(): FixtureThread {
    return {
      id: 'T-reimported',
      createdAtMs: T0,
      updatedAtMs: IMPORTED_AT_MS + 10_000 * SEC,
      rollout: [
        // After the first import, but within the second import's replay window.
        started(IMPORTED_AT_MS + 3600 * SEC, 'user'),
        completed(IMPORTED_AT_MS + 3610 * SEC),
        started(LATER_IMPORT_S * 1000 + 1800 * SEC, 'user'),
        completed(LATER_IMPORT_S * 1000 + 1830 * SEC),
      ],
    };
  }

  it.each([
    ['earlier record first', [IMPORTED_AT_S, LATER_IMPORT_S]],
    ['later record first', [LATER_IMPORT_S, IMPORTED_AT_S]],
  ])('applies the latest imported_at when a thread was imported more than once (%s)', (_label, times) => {
    const dir = buildCodexDir({
      threads: [reimportedThread()],
      imports: { records: times.map((t) => importRecord('T-reimported', t)) },
    });
    const { invocation } = readThread(dir, 'T-reimported');
    expect(invocation.agentSpans).toEqual([
      {
        startMs: LATER_IMPORT_S * 1000 + 1800 * SEC,
        endMs: LATER_IMPORT_S * 1000 + 1830 * SEC,
      },
    ]);
    expect(invocation.promptsMs).toEqual([LATER_IMPORT_S * 1000 + 1800 * SEC]);
    expect(invocation.startMs).toBe(LATER_IMPORT_S * 1000 + 1800 * SEC);
  });

  it.each([
    ['numeric record first', [IMPORTED_AT_S, 'unknown']],
    ['non-numeric record first', ['unknown', IMPORTED_AT_S]],
  ])('skips a re-imported thread when any of its records has no numeric imported_at (%s)', (_label, times) => {
    const dir = buildCodexDir({
      threads: [reimportedThread()],
      imports: { records: times.map((t) => importRecord('T-reimported', t)) },
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expect(invocations).toHaveLength(0);
    expect(diagnostics.some((d) => /^1 Codex thread\(s\) skipped: /.test(d.reason))).toBe(true);
  });

  it('keeps sub-agent threads of a skipped import under the imported launch id', () => {
    const dir = buildCodexDir({
      threads: [
        {
          id: 'T-imported-parent',
          createdAtMs: T0 - 86_400 * SEC,
          updatedAtMs: IMPORTED_AT_MS,
          rollout: replay(IMPORTED_AT_MS),
        },
        {
          id: 'T-native-child',
          createdAtMs: IMPORTED_AT_MS + 600 * SEC,
          updatedAtMs: IMPORTED_AT_MS + 700 * SEC,
          source: 'subagent',
          rollout: [
            started(IMPORTED_AT_MS + 610 * SEC),
            completed(IMPORTED_AT_MS + 650 * SEC),
          ],
        },
      ],
      edges: [['T-imported-parent', 'T-native-child']],
      imports: { records: [importRecord('T-imported-parent')] },
    });
    const { invocations } = new CodexReader({ baseDir: dir }).read();
    expect(invocations.map((i) => i.invocationId)).toEqual(['T-native-child']);
    expect(invocations[0]?.launchRootId).toBe('T-imported-parent');
    expect(invocations[0]?.agentSpans).toEqual([
      { startMs: IMPORTED_AT_MS + 610 * SEC, endMs: IMPORTED_AT_MS + 650 * SEC },
    ]);
  });

  it('reports every thread as before, without warnings, when the imports file is absent', () => {
    const dir = buildCodexDir({
      threads: [
        nativeThread,
        {
          id: 'T-replay-shaped',
          createdAtMs: T0,
          updatedAtMs: IMPORTED_AT_MS,
          rollout: replay(IMPORTED_AT_MS),
        },
      ],
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expectNativeUnchanged(invocations);
    const replayed = invocations.find((i) => i.invocationId === 'T-replay-shaped');
    expect(replayed?.agentSpans).toHaveLength(2);
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ['not JSON', '{"records": [ SECRET-BROKEN'],
    ['records not an array', JSON.stringify({ records: 'SECRET-NOT-A-LIST' })],
    ['top level not an object', JSON.stringify(['SECRET-ARRAY'])],
  ])('reports threads as before with a content-free warning when the imports file is malformed (%s)', (_label, text) => {
    const dir = buildCodexDir({
      threads: [
        nativeThread,
        {
          id: 'T-replay-shaped',
          createdAtMs: T0,
          updatedAtMs: IMPORTED_AT_MS,
          rollout: replay(IMPORTED_AT_MS),
        },
      ],
      imports: text,
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expectNativeUnchanged(invocations);
    expect(invocations.map((i) => i.invocationId).sort()).toEqual([
      'T-native',
      'T-replay-shaped',
    ]);
    expect(diagnostics).toEqual([
      {
        provider: 'codex',
        filePath: path.join(dir, 'external_agent_session_imports.json'),
        reason: 'Codex session imports file is malformed; imported threads cannot be identified',
        severity: 'warning',
      },
    ]);
  });
});

describe('CodexReader imports file access', () => {
  it('reports threads as before with a content-free warning when the imports file is unreadable', () => {
    const dir = buildCodexDir({ threads: [nativeThread] });
    // A directory in place of the file makes the read fail.
    fs.mkdirSync(path.join(dir, 'external_agent_session_imports.json'));
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expectNativeUnchanged(invocations);
    expect(diagnostics).toEqual([
      {
        provider: 'codex',
        filePath: path.join(dir, 'external_agent_session_imports.json'),
        reason: 'Codex session imports file could not be read; imported threads cannot be identified',
        severity: 'warning',
      },
    ]);
  });

  it('ignores import records without a thread id with a counted warning', () => {
    const dir = buildCodexDir({
      threads: [nativeThread],
      imports: { records: [{ imported_at: IMPORTED_AT_S, title: 'SECRET-TITLE' }, 'SECRET-STRING'] },
    });
    const { invocations, diagnostics } = new CodexReader({ baseDir: dir }).read();
    expectNativeUnchanged(invocations);
    expect(diagnostics.map((d) => d.reason)).toEqual([
      '2 Codex session import record(s) ignored: no imported thread id',
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
  });
});
