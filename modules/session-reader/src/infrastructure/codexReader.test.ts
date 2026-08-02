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
      thread_source TEXT, name TEXT
    );
    CREATE TABLE thread_spawn_edges (
      parent_thread_id TEXT, child_thread_id TEXT, status TEXT
    );
  `);
  const insThread = state.prepare(
    'INSERT INTO threads (id, created_at_ms, updated_at_ms, cwd, thread_source, name) VALUES (?,?,?,?,?,?)',
  );
  // Root CLI thread.
  insThread.run('T-root', 1000, 500000, '/home/dev/app', 'user', 'codex-work');
  // Sub-agent thread under the root, in the same dir.
  insThread.run('T-sub', 5000, 400000, '/home/dev/app', 'subagent', null);
  // Independent app thread.
  insThread.run('T-app', 2000, 600000, '/home/dev/app2', 'user', null);
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
  logs.close();

  fs.writeFileSync(
    path.join(baseDir, 'history.jsonl'),
    JSON.stringify({ session_id: 'T-root', ts: 1, text: '' }) + '\n',
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
        d.reason.includes('session rename history unavailable'),
      ),
    ).toBe(true);
  });
});
