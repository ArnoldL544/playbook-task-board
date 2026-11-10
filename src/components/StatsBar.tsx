import { dueState } from '../lib/format';
import type { Task } from '../types';

export function StatsBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inFlight = tasks.filter((t) => t.status === 'in_progress' || t.status === 'in_review').length;
  const overdue = tasks.filter((t) => dueState(t.due_date, t.status === 'done') === 'overdue').length;
  const dueSoon = tasks.filter((t) => {
    const s = dueState(t.due_date, t.status === 'done');
    return s === 'today' || s === 'soon';
  }).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section className="stats" aria-label="Board summary">
      <div className="stat stat--progress">
        <div className="stat__top">
          <span className="stat__label">Completed</span>
          <span className="stat__value">
            {done}
            <small>/{total}</small>
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tasks completed"
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="stat__hint">{pct}% of tasks done</span>
      </div>
      <Stat label="Total tasks" value={total} />
      <Stat label="In flight" value={inFlight} hint="In progress or review" />
      <Stat label="Due soon" value={dueSoon} hint="Today – 2 days" tone={dueSoon > 0 ? 'warn' : undefined} />
      <Stat label="Overdue" value={overdue} hint="Past due, not done" tone={overdue > 0 ? 'danger' : undefined} />
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'warn' | 'danger' }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}
