import { describe, it, expect } from 'vitest';
import { FilterService } from './filterService';
import { UsageError } from './errors';
import { ReportRow } from '../domain/reportRow';

function row(partial: Partial<ReportRow>): ReportRow {
  return {
    launchId: 'L',
    launchShort: 'abc',
    agent: 'codex-cli',
    path: '/home/dev/app',
    name: null,
    humanMs: 0,
    agentTimeMs: 0,
    elapsedMs: 0,
    inactiveMs: 0,
    startMs: 0,
    endMs: 1,
    actualStartMs: 0,
    actualEndMs: 1,
    truncated: false,
    active: false,
    subagentCount: 0,
    segmentStartMs: 0,
    ...partial,
  };
}

describe('FilterService.resolveAgentFilters', () => {
  it('expands the codex family to codex-cli and codex-app', () => {
    expect([...FilterService.resolveAgentFilters(['codex'])].sort()).toEqual([
      'codex-app',
      'codex-cli',
    ]);
  });

  it('expands the copilot family to copilot-cli', () => {
    expect([...FilterService.resolveAgentFilters(['copilot'])]).toEqual([
      'copilot-cli',
    ]);
  });

  it('unions repeated values without duplicates', () => {
    const set = FilterService.resolveAgentFilters(['codex', 'codex-cli']);
    expect(set.size).toBe(2);
  });

  it('throws UsageError on an unknown agent', () => {
    expect(() => FilterService.resolveAgentFilters(['nope'])).toThrow(
      UsageError,
    );
  });
});

describe('FilterService.expandPathFilters', () => {
  const ctx = { homeDir: '/home/dev', cwd: '/home/dev/work' };

  it('expands ~ and ~/... to the home directory', () => {
    expect(FilterService.expandPathFilters(['~', '~/app'], ctx)).toEqual([
      '/home/dev',
      '/home/dev/app',
    ]);
  });

  it('resolves relative paths against cwd and normalizes separators', () => {
    expect(FilterService.expandPathFilters(['sub//dir/'], ctx)).toEqual([
      '/home/dev/work/sub/dir',
    ]);
  });
});

describe('FilterService.filterRows', () => {
  it('recursively matches rows under a path filter', () => {
    const rows = [
      row({ path: '/home/dev/app/pkg' }),
      row({ path: '/home/dev/other' }),
      row({ path: null }),
    ];
    const filtered = FilterService.filterRows(rows, {
      expandedPaths: ['/home/dev/app'],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe('/home/dev/app/pkg');
  });

  it('excludes unknown-path rows when a path filter is active', () => {
    const filtered = FilterService.filterRows([row({ path: null })], {
      expandedPaths: ['/home/dev'],
    });
    expect(filtered).toHaveLength(0);
  });

  it('filters by agent', () => {
    const rows = [row({ agent: 'codex-cli' }), row({ agent: 'copilot-cli' })];
    const filtered = FilterService.filterRows(rows, {
      agents: new Set(['copilot-cli'] as const),
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].agent).toBe('copilot-cli');
  });
});
