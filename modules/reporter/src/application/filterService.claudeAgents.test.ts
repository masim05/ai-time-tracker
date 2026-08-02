import { describe, expect, it } from 'vitest';
import { FilterService } from './filterService';
import { UsageError } from './errors';

describe('FilterService agent values for Claude', () => {
  it('expands the claude family to claude-cli', () => {
    expect([...FilterService.resolveAgentFilters(['claude'])]).toEqual([
      'claude-cli',
    ]);
  });

  it('accepts the exact claude-cli interface', () => {
    expect([...FilterService.resolveAgentFilters(['claude-cli'])]).toEqual([
      'claude-cli',
    ]);
  });

  it('unions repeated selections across providers without duplicates', () => {
    const set = FilterService.resolveAgentFilters([
      'claude',
      'claude-cli',
      'codex',
      'copilot-cli',
    ]);
    expect([...set].sort()).toEqual([
      'claude-cli',
      'codex-app',
      'codex-cli',
      'copilot-cli',
    ]);
  });

  it.each(['claude-app', 'claude-vsc'])(
    'rejects %s with an explanation instead of an empty report',
    (value) => {
      expect(() => FilterService.resolveAgentFilters([value])).toThrow(
        UsageError,
      );
      expect(() => FilterService.resolveAgentFilters([value])).toThrow(
        /is not supported: .*no local session data/,
      );
    },
  );

  it('still rejects an unknown value and lists the valid ones', () => {
    expect(() => FilterService.resolveAgentFilters(['claude-web'])).toThrow(
      /Unknown agent value.*claude-cli.*claude/s,
    );
  });

  it.each(['constructor', 'toString', '__proto__', 'valueOf'])(
    'treats the inherited property %s as an unknown agent value',
    (value) => {
      expect(() => FilterService.resolveAgentFilters([value])).toThrow(
        /Unknown agent value/,
      );
    },
  );
});
