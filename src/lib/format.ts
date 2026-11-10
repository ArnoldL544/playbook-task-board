/* Date, color and ordering helpers shared across the UI. */

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none';

const DAY = 24 * 60 * 60 * 1000;

/** Today's date as YYYY-MM-DD in the viewer's local timezone. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parses YYYY-MM-DD as a local-midnight date (avoids the UTC off-by-one). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(iso: string): number {
  const today = parseLocalDate(todayISO());
  return Math.round((parseLocalDate(iso).getTime() - today.getTime()) / DAY);
}

export function dueState(iso: string | null, done: boolean): DueState {
  if (!iso) return 'none';
  if (done) return 'later';
  const days = daysUntil(iso);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 2) return 'soon';
  return 'later';
}

export function formatDue(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0 && days > -7) return `${-days} days ago`;
  const date = parseLocalDate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", or a date. */
export function timeAgo(isoTimestamp: string): string {
  const diff = (new Date(isoTimestamp).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (!rtf) return new Date(isoTimestamp).toLocaleString();
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(isoTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Curated swatches for members and labels — chosen to read well on light and dark. */
export const SWATCHES = [
  '#5b5bd6', // indigo
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#22c55e', // green
  '#eab308', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#64748b', // slate
];

export function randomSwatch(exclude: string[] = []): string {
  const pool = SWATCHES.filter((c) => !exclude.includes(c));
  const list = pool.length > 0 ? pool : SWATCHES;
  return list[Math.floor(Math.random() * list.length)];
}

const GAP = 1024;

/**
 * Fractional ordering: a task's position is a float, and dropping between two
 * cards takes the midpoint, so a move only ever updates the moved row.
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return (after as number) - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}
