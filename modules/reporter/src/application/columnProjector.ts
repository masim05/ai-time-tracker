import {
  ColumnId,
  ColumnSpec,
  CellValue,
  COLUMNS,
  DEFAULT_COLUMN_IDS,
  getColumn,
} from '../domain/column';
import { ReportRow } from '../domain/reportRow';
import { UsageError } from './errors';

/** A projected report: chosen columns plus one raw cell array per row. */
export interface ProjectedReport {
  readonly columns: readonly ColumnSpec[];
  readonly rows: readonly CellValue[][];
}

/**
 * Resolves the `--columns` selection and projects rows onto the chosen columns.
 *
 * Selection grammar:
 *  - Omitted → default columns.
 *  - Replacement mode: comma-separated bare ids (`start,inactive`). Duplicates or
 *    unknown ids are errors.
 *  - Modification mode: every token is signed (`+id` / `-id`) and applied to the
 *    default columns. Adding an existing column or removing an absent one is a
 *    no-op. Mixing signed and unsigned tokens is an error.
 *  - An empty final selection is an error.
 */
export const ColumnProjector = {
  resolveColumns(raw: readonly string[] | undefined): ColumnId[] {
    if (!raw || raw.length === 0) {
      return [...DEFAULT_COLUMN_IDS];
    }
    if (raw.length > 1) {
      throw new UsageError('Option --columns may be provided only once.');
    }
    const tokens = raw[0]
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tokens.length === 0) {
      throw new UsageError('Option --columns must not be empty.');
    }

    const signed = tokens.filter((t) => t.startsWith('+') || t.startsWith('-'));
    if (signed.length > 0 && signed.length !== tokens.length) {
      throw new UsageError(
        'Option --columns must not mix signed (+/-) and unsigned column names.',
      );
    }

    if (signed.length === 0) {
      return resolveReplacement(tokens);
    }
    return resolveModification(tokens);
  },

  project(
    rows: readonly ReportRow[],
    columnIds: readonly ColumnId[],
  ): ProjectedReport {
    const columns = columnIds.map((id) => getColumn(id) as ColumnSpec);
    const projected = rows.map((row) => columns.map((c) => c.accessor(row)));
    return { columns, rows: projected };
  },
};

function assertKnown(id: string): ColumnId {
  const spec = getColumn(id);
  if (!spec) {
    const valid = COLUMNS.map((c) => c.id).join(', ');
    throw new UsageError(`Unknown column: '${id}'. Valid columns: ${valid}.`);
  }
  return spec.id;
}

function resolveReplacement(tokens: string[]): ColumnId[] {
  const result: ColumnId[] = [];
  for (const token of tokens) {
    const id = assertKnown(token);
    if (result.includes(id)) {
      throw new UsageError(`Duplicate column in --columns: '${id}'.`);
    }
    result.push(id);
  }
  return result;
}

function resolveModification(tokens: string[]): ColumnId[] {
  const result: ColumnId[] = [...DEFAULT_COLUMN_IDS];
  for (const token of tokens) {
    const sign = token[0];
    const id = assertKnown(token.slice(1));
    if (sign === '+') {
      if (!result.includes(id)) {
        result.push(id);
      }
    } else {
      const idx = result.indexOf(id);
      if (idx >= 0) {
        result.splice(idx, 1);
      }
    }
  }
  if (result.length === 0) {
    throw new UsageError('Option --columns produced an empty column selection.');
  }
  return result;
}
