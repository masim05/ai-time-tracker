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
      thread_source TEXT, name TEXT, title TEXT
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
