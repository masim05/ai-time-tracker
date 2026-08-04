import { describe, it, expect } from 'vitest';
import { runReport, ReportDeps } from './reportCommand';
import { NormalizedInvocation, Diagnostic } from '../../../session-reader';

const MIN = 60 * 1000;
const NOW = Date.UTC(2026, 7, 2, 0, 0, 0);

function invocation(
  partial: Partial<NormalizedInvocation> = {},
): NormalizedInvocation {
  const start = Date.UTC(2026, 7, 1, 10, 0, 0);
  return {
    provider: 'codex',
    interfaceId: 'codex-cli',
    launchRootId: 'launch-a',
    invocationId: 'launch-a',
    isRoot: true,
    promptsMs: [start],
    agentSpans: [{ startMs: start, endMs: start + 10 * MIN }],
    startMs: start,
    endMs: start + 10 * MIN,
    cwd: '/home/dev/app',
    ...partial,
  };
}

function deps(
  invocations: NormalizedInvocation[],
  diagnostics: Diagnostic[] = [],
): ReportDeps {
  return {
    readSessions: () => ({ invocations, diagnostics }),
    now: () => NOW,
    homeDir: '/home/dev',
    cwd: '/home/dev/work',
    offsetAt: () => 0,
  };
}

describe('runReport', () => {
  it('renders a default table and exits 0', () => {
    const result = runReport({}, deps([invocation()]));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('agent');
    expect(result.stdout).toContain('codex-cli');
  });

  it('renders JSON output', () => {
    const result = runReport({ output: 'json' }, deps([invocation()]));
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].agent).toBe('codex-cli');
  });

  it('renders CSV output', () => {
    const result = runReport({ output: 'csv' }, deps([invocation()]));
    expect(result.stdout.split('\n')[0]).toContain('agent-time');
  });

  it('warns and exits 0 when no sessions match', () => {
    const result = runReport(
      { from: '2099-01-01' },
      deps([invocation()]),
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('No matching sessions found.');
  });

  it('exits 2 for an unknown output format', () => {
    const result = runReport({ output: 'xml' }, deps([invocation()]));
    expect(result.exitCode).toBe(2);
  });

  it('exits 2 for a mixed --columns selection', () => {
    const result = runReport(
      { columns: ['launch,+inactive'] },
      deps([invocation()]),
    );
    expect(result.exitCode).toBe(2);
  });

  it('exits 2 when --from is after --to', () => {
    const result = runReport(
      { from: '2026-08-02', to: '2026-07-01' },
      deps([invocation()]),
    );
    expect(result.exitCode).toBe(2);
  });

  it('exits 2 for an unknown agent value', () => {
    const result = runReport({ agent: ['bogus'] }, deps([invocation()]));
    expect(result.exitCode).toBe(2);
  });

  it('produces a partial result and exit 1 on error diagnostics', () => {
    const diag: Diagnostic = {
      provider: 'copilot',
      interfaceId: 'copilot-cli',
      sessionId: 'abc',
      filePath: '/home/dev/.copilot/session-state/abc/events.jsonl',
      reason: 'malformed JSON at line 3',
      severity: 'error',
    };
    const result = runReport({}, deps([invocation()], [diag]));
    expect(result.exitCode).toBe(1);
    // Valid data still present.
    expect(result.stdout).toContain('codex-cli');
    // Non-verbose: summary only.
    expect(result.stderr).toContain('re-run with --verbose');
  });

  it('emits per-record diagnostics with --verbose and no session content', () => {
    const diag: Diagnostic = {
      provider: 'copilot',
      interfaceId: 'copilot-cli',
      sessionId: 'abc',
      filePath: '/home/dev/.copilot/session-state/abc/events.jsonl',
      reason: 'malformed JSON at line 3',
      severity: 'error',
    };
    const result = runReport({ verbose: true }, deps([invocation()], [diag]));
    expect(result.stderr).toContain('provider=copilot');
    expect(result.stderr).toContain('session=abc');
    expect(result.stderr).toContain('reason=malformed JSON at line 3');
  });

  it('filters by agent family', () => {
    const result = runReport(
      { agent: ['copilot'], output: 'json' },
      deps([invocation(), invocation({ interfaceId: 'copilot-cli', launchRootId: 'launch-b', invocationId: 'launch-b' })]),
    );
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].agent).toBe('copilot-cli');
  });

  it('filters by path and excludes unknown-path rows', () => {
    const result = runReport(
      { path: ['~/app'], output: 'json' },
      deps([
        invocation(),
        invocation({
          launchRootId: 'launch-c',
          invocationId: 'launch-c',
          cwd: undefined,
        }),
      ]),
    );
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe('/home/dev/app');
  });
});
