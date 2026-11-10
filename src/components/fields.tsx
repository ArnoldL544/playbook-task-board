import { addDaysISO } from '../lib/format';
import { PRIORITIES, STATUSES, type Label, type Member, type Priority, type Status } from '../types';
import { PlusIcon, PriorityIcon } from './Icons';
import { Avatar, CheckList, LabelChip, Popover } from './ui';

/* Reusable task fields shared by the create dialog and the detail panel. */

export function StatusSelect({ value, onChange, id }: { value: Status; onChange: (s: Status) => void; id?: string }) {
  return (
    <div className={`select select--status select--${value}`}>
      <span className="select__dot" aria-hidden="true" />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Status)}>
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PrioritySegment({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="segment" role="radiogroup" aria-label="Priority">
      {[...PRIORITIES].reverse().map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          className={`segment__item priority--${p.id}${value === p.id ? ' is-on' : ''}`}
          onClick={() => onChange(p.id)}
        >
          <PriorityIcon level={p.id} />
          {p.name}
        </button>
      ))}
    </div>
  );
}

export function DueDateField({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (d: string | null) => void;
  id?: string;
}) {
  const quick = [
    { name: 'Today', value: addDaysISO(0) },
    { name: 'Tomorrow', value: addDaysISO(1) },
    { name: 'Next week', value: addDaysISO(7) },
  ];
  return (
    <div className="due-field">
      <input
        id={id}
        type="date"
        className="input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
      <div className="due-field__quick">
        {quick.map((q) => (
          <button
            key={q.name}
            type="button"
            className={`pill${value === q.value ? ' is-on' : ''}`}
            onClick={() => onChange(q.value)}
          >
            {q.name}
          </button>
        ))}
        {value && (
          <button type="button" className="pill pill--quiet" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function AssigneePicker({
  members,
  value,
  onChange,
  onManage,
}: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  onManage?: () => void;
}) {
  const selected = members.filter((m) => value.includes(m.id));
  return (
    <div className="picker">
      {selected.map((m) => (
        <button
          key={m.id}
          type="button"
          className="person-chip"
          onClick={() => onChange(value.filter((id) => id !== m.id))}
          title={`Unassign ${m.name}`}
        >
          <Avatar member={m} size={18} />
          {m.name}
        </button>
      ))}
      <Popover
        width={230}
        trigger={({ toggle: open, id }) => (
          <button type="button" className="pill pill--add" onClick={open} aria-controls={id}>
            <PlusIcon size={12} /> {selected.length ? 'Edit' : 'Assign'}
          </button>
        )}
      >
        {(close) => (
          <>
            <CheckList
              options={members.map((m) => ({ id: m.id, name: m.name, leading: <Avatar member={m} size={18} /> }))}
              selected={value}
              onToggle={(id) => onChange(toggle(value, id))}
              empty="Your team is empty."
            />
            {onManage && (
              <button
                type="button"
                className="popover__footer-btn"
                onClick={() => {
                  close();
                  onManage();
                }}
              >
                Manage team…
              </button>
            )}
          </>
        )}
      </Popover>
    </div>
  );
}

export function LabelPicker({
  labels,
  value,
  onChange,
  onManage,
}: {
  labels: Label[];
  value: string[];
  onChange: (ids: string[]) => void;
  onManage?: () => void;
}) {
  const selected = labels.filter((l) => value.includes(l.id));
  return (
    <div className="picker">
      {selected.map((l) => (
        <LabelChip key={l.id} label={l} onRemove={() => onChange(value.filter((id) => id !== l.id))} />
      ))}
      <Popover
        width={220}
        trigger={({ toggle: open, id }) => (
          <button type="button" className="pill pill--add" onClick={open} aria-controls={id}>
            <PlusIcon size={12} /> {selected.length ? 'Edit' : 'Add label'}
          </button>
        )}
      >
        {(close) => (
          <>
            <CheckList
              options={labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
              selected={value}
              onToggle={(id) => onChange(toggle(value, id))}
              empty="No labels yet."
            />
            {onManage && (
              <button
                type="button"
                className="popover__footer-btn"
                onClick={() => {
                  close();
                  onManage();
                }}
              >
                Manage labels…
              </button>
            )}
          </>
        )}
      </Popover>
    </div>
  );
}
