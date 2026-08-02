import { ProjectedReport } from '../application/columnProjector';
import { CellValue, ColumnSpec } from '../domain/column';
import {
  formatDuration,
  formatLocalTimestamp,
  substituteHome,
} from './formatUtils';

export interface TableFormatterOptions {
  readonly homeDir?: string;
}

/** Renders a projected report as an aligned plain-text table. */
export class TableFormatter {
  constructor(private readonly options: TableFormatterOptions = {}) {}

  format(report: ProjectedReport): string {
    const { columns, rows } = report;
    const headers = columns.map((c) => c.header);
    const body = rows.map((row) =>
      row.map((value, i) => this.renderCell(columns[i], value)),
    );
    const totalRow = this.buildTotalRow(columns, rows);

    const widths = columns.map((_c, i) => {
      let w = headers[i].length;
      for (const row of body) {
        w = Math.max(w, row[i].length);
      }
      w = Math.max(w, totalRow[i].length);
      return w;
    });

    const rightAlign = columns.map((c) => c.kind === 'duration');
    const lines: string[] = [];
    lines.push(this.renderRow(headers, widths, rightAlign));
    for (const row of body) {
      lines.push(this.renderRow(row, widths, rightAlign));
    }
    if (rows.length > 0) {
      lines.push(widths.map((w) => '-'.repeat(w)).join('  '));
      lines.push(this.renderRow(totalRow, widths, rightAlign));
    }
    return lines.join('\n');
  }

  private buildTotalRow(
    columns: readonly ColumnSpec[],
    rows: readonly CellValue[][],
  ): string[] {
    let firstTextDone = false;
    return columns.map((col, i) => {
      if (col.additive && col.kind === 'duration') {
        const sum = rows.reduce(
          (acc, row) => acc + Number(row[i] ?? 0),
          0,
        );
        return formatDuration(sum);
      }
      if (col.kind === 'text') {
        if (!firstTextDone) {
          firstTextDone = true;
          return 'total';
        }
        return '';
      }
      return '';
    });
  }

  private renderRow(
    cells: string[],
    widths: number[],
    rightAlign: boolean[],
  ): string {
    return cells
      .map((cell, i) =>
        rightAlign[i] ? cell.padStart(widths[i]) : cell.padEnd(widths[i]),
      )
      .join('  ')
      .replace(/\s+$/, '');
  }

  private renderCell(column: ColumnSpec, value: CellValue): string {
    switch (column.kind) {
      case 'duration':
        return formatDuration(Number(value));
      case 'timestamp':
        return value === null ? '' : formatLocalTimestamp(Number(value));
      case 'boolean':
        return value ? 'true' : 'false';
      case 'text':
      default:
        if (value === null) {
          if (column.id === 'name') {
            return '-';
          }
          return 'unknown';
        }
        if (column.id === 'path') {
          return substituteHome(String(value), this.options.homeDir);
        }
        return String(value);
    }
  }
}
