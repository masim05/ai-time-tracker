import { describe, it, expect } from 'vitest';
import { ColumnProjector } from './columnProjector';
import { DEFAULT_COLUMN_IDS } from '../domain/column';
import { UsageError } from './errors';

describe('ColumnProjector.resolveColumns', () => {
  it('returns default columns when omitted', () => {
    expect(ColumnProjector.resolveColumns(undefined)).toEqual([
      ...DEFAULT_COLUMN_IDS,
    ]);
  });

  it('supports replacement mode', () => {
    expect(ColumnProjector.resolveColumns(['start,inactive'])).toEqual([
      'start',
      'inactive',
    ]);
  });

  it('supports add modification', () => {
    expect(ColumnProjector.resolveColumns(['+inactive'])).toEqual([
      ...DEFAULT_COLUMN_IDS,
      'inactive',
    ]);
  });

  it('supports remove+add modification in order', () => {
    expect(
      ColumnProjector.resolveColumns(['-start,+inactive,+actual-start']),
    ).toEqual([
      'agent',
      'path',
      'name',
      'human',
      'agent-time',
      'duration',
      'subagents',
      'inactive',
      'actual-start',
    ]);
  });

  it('treats adding an existing column as a no-op', () => {
    expect(ColumnProjector.resolveColumns(['+agent'])).toEqual([
      ...DEFAULT_COLUMN_IDS,
    ]);
  });

  it('treats removing an absent column as a no-op', () => {
    expect(ColumnProjector.resolveColumns(['-inactive'])).toEqual([
      ...DEFAULT_COLUMN_IDS,
    ]);
  });

  it('rejects mixed signed and unsigned tokens', () => {
    expect(() => ColumnProjector.resolveColumns(['launch,+inactive'])).toThrow(
      UsageError,
    );
  });

  it('rejects unknown columns', () => {
    expect(() => ColumnProjector.resolveColumns(['bogus'])).toThrow(UsageError);
  });

  it('rejects duplicate replacement columns', () => {
    expect(() => ColumnProjector.resolveColumns(['start,start'])).toThrow(
      UsageError,
    );
  });

  it('rejects repeated --columns options', () => {
    expect(() => ColumnProjector.resolveColumns(['start', 'end'])).toThrow(
      UsageError,
    );
  });

  it('rejects an empty final selection', () => {
    const removeAll = DEFAULT_COLUMN_IDS.map((id) => `-${id}`).join(',');
    expect(() => ColumnProjector.resolveColumns([removeAll])).toThrow(
      UsageError,
    );
  });
});
