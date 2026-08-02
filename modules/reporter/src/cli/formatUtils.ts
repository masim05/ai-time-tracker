import * as os from 'os';

/** Rounds a millisecond duration to whole minutes. */
export function durationToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

/**
 * Formats a duration for table output: `0m`, `3m`, `10h3m`, `2d10h3m`.
 * Hours are shown when there are days or hours; minutes are always shown.
 */
export function formatDuration(ms: number): string {
  const totalMin = durationToMinutes(ms);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const minutes = totalMin % 60;
  let out = '';
  if (days > 0) {
    out += `${days}d`;
  }
  if (days > 0 || hours > 0) {
    out += `${hours}h`;
  }
  out += `${minutes}m`;
  return out;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Local timestamp for table output: `2026-08-01 17:01`. */
export function formatLocalTimestamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** ISO 8601 with the machine's UTC offset: `2026-08-01T17:01:46+03:00`. */
export function formatIsoWithOffset(ms: number): string {
  const d = new Date(ms);
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`
  );
}

/** Substitutes the home directory prefix with `~` for table display. */
export function substituteHome(
  path: string,
  homeDir: string = os.homedir(),
): string {
  if (path === homeDir) {
    return '~';
  }
  if (path.startsWith(homeDir + '/')) {
    return '~' + path.slice(homeDir.length);
  }
  return path;
}
