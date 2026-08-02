import { ProjectedReport } from '../application/columnProjector';
import { CellValue, ColumnSpec } from '../domain/column';
import { durationToMinutes, formatIsoWithOffset } from './formatUtils';

/** Renders a projected report as a JSON array of objects. */
export class JsonFormatter {
  format(report: ProjectedReport): string {
    const objects = report.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      row.forEach((value, i) => {
        const column = report.columns[i];
        obj[column.header] = this.renderValue(column, value);
      });
      return obj;
    });
    return JSON.stringify(objects, null, 2);
  }

  private renderValue(column: ColumnSpec, value: CellValue): unknown {
    switch (column.kind) {
      case 'duration':
        return durationToMinutes(Number(value));
      case 'timestamp':
        return value === null ? null : formatIsoWithOffset(Number(value));
      case 'boolean':
        return Boolean(value);
      case 'text':
      default:
        return value === null ? null : String(value);
    }
  }
}
