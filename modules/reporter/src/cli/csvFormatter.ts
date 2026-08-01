import { ProjectedReport } from '../application/columnProjector';
import { CellValue, ColumnSpec } from '../domain/column';
import { durationToMinutes, formatIsoWithOffset } from './formatUtils';

/** Renders a projected report as CSV (header row + data rows). */
export class CsvFormatter {
  format(report: ProjectedReport): string {
    const header = report.columns.map((c) => escapeCsv(c.header)).join(',');
    const lines = [header];
    for (const row of report.rows) {
      lines.push(
        row
          .map((value, i) => escapeCsv(this.renderField(report.columns[i], value)))
          .join(','),
      );
    }
    return lines.join('\n');
  }

  private renderField(column: ColumnSpec, value: CellValue): string {
    switch (column.kind) {
      case 'duration':
        return String(durationToMinutes(Number(value)));
      case 'timestamp':
        return value === null ? '' : formatIsoWithOffset(Number(value));
      case 'boolean':
        return value ? 'true' : 'false';
      case 'text':
      default:
        return value === null ? '' : String(value);
    }
  }
}

function escapeCsv(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}
