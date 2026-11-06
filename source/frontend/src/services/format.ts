/**
 * Display formatting helpers for timestamps and CSV export.
 * The backend stores two timestamp shapes:
 *   - "Aug 07, 2026, 10:30 AM"  (PHP date('M d, Y, h:i A'))
 *   - "2026-08-07 10:30 AM"      (legacy / speed logs)
 *   - ISO 8601 (createdAtISO, timeline)
 */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseDisplayDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /T\d{2}:\d{2}/.test(raw)) return iso;

  const named = raw.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) (AM|PM)$/i);
  if (named) {
    const month = MONTHS[named[1].slice(0, 1).toUpperCase() + named[1].slice(1, 3).toLowerCase()];
    if (month !== undefined) {
      let hour = Number(named[4]) % 12;
      if (named[6].toUpperCase() === 'PM') hour += 12;
      const date = new Date(Number(named[3]), month, Number(named[2]), hour, Number(named[5]), 0);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  const compact = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (compact) {
    let hour = Number(compact[4]);
    if (compact[7]) {
      hour = hour % 12;
      if (compact[7].toUpperCase() === 'PM') hour += 12;
    }
    const date = new Date(
      Number(compact[1]),
      Number(compact[2]) - 1,
      Number(compact[3]),
      hour,
      Number(compact[5]),
      compact[6] ? Number(compact[6]) : 0,
    );
    if (!Number.isNaN(date.getTime())) return date;
  }

  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function formatAbsoluteTime(value: string | null | undefined): string {
  const date = parseDisplayDateTime(value);
  if (!date) return value || '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Local calendar day as YYYY-MM-DD (not UTC — the app reports in local time). */
export function toLocalDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function todayKey(): string {
  return toLocalDayKey(new Date());
}

/**
 * The local calendar day a stored timestamp falls on, or null when it cannot be
 * parsed. Used to tell a value confirmed today apart from one merely carried
 * over from an earlier day.
 */
export function timestampDayKey(value: string | null | undefined): string | null {
  const date = parseDisplayDateTime(value);
  return date ? toLocalDayKey(date) : null;
}

/** Whole days between a stored timestamp and now; negative means in the past. */
export function daysSince(value: string | null | undefined, now: Date = new Date()): number | null {
  const date = parseDisplayDateTime(value);
  if (!date) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
}

export function formatRelativeTime(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  const date = parseDisplayDateTime(value);
  if (!date) return value || '—';

  const diffMs = date.getTime() - now.getTime();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 40) return diffMs < 0 ? 'just now' : 'just now';

  const sign = diffMs < 0 ? -1 : 1;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 60 * 60],
    ['day', 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['year', 365 * 24 * 60 * 60],
  ];
  for (const [unit, seconds] of units) {
    if (absSeconds < seconds * 1.9) {
      if (unit === 'minute' && absSeconds < 60 * 45) {
        return RELATIVE.format(sign * Math.round(absSeconds / seconds), unit);
      }
      if (unit === 'hour' && absSeconds < 60 * 60 * 21) {
        return RELATIVE.format(sign * Math.round(absSeconds / seconds), unit);
      }
    }
  }
  if (absSeconds < 365 * 24 * 60 * 60 * 1.9) {
    return RELATIVE.format(sign * Math.round(absSeconds / (30 * 24 * 60 * 60)), 'month');
  }
  return RELATIVE.format(sign * Math.round(absSeconds / (365 * 24 * 60 * 60)), 'year');
}

function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvField).join(','));
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvField(cell === null || cell === undefined ? '' : String(cell))).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}