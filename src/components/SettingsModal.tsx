import { useState, type FormEvent, type ReactNode } from 'react';
import { randomSwatch, SWATCHES } from '../lib/format';
import type { Label, Member, Task } from '../types';
import { CheckIcon, PlusIcon, TagIcon, TrashIcon, UsersIcon } from './Icons';
import { Avatar, LabelChip, Modal, Spinner } from './ui';

interface Props {
  members: Member[];
  labels: Label[];
  tasks: Task[];
  onCreateMember: (name: string, color: string) => Promise<Member | null>;
  onDeleteMember: (id: string) => Promise<boolean>;
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
  onDeleteLabel: (id: string) => Promise<boolean>;
  onClose: () => void;
}

export function SettingsModal(p: Props) {
  return (
    <Modal title="Team & labels" onClose={p.onClose} size="lg">
      <div className="settings">
        <section className="settings__section">
          <h3>
            <UsersIcon /> Team members
          </h3>
          <p className="settings__hint">People you can assign to tasks. Their avatars show on cards.</p>
          <ul className="settings__list">
            {p.members.map((m) => (
              <Row
                key={m.id}
                leading={<Avatar member={m} size={26} />}
                name={m.name}
                usage={p.tasks.filter((t) => t.assigneeIds.includes(m.id)).length}
                onDelete={() => p.onDeleteMember(m.id)}
              />
            ))}
            {p.members.length === 0 && <li className="settings__empty">No teammates yet — add your first one below.</li>}
          </ul>
          <AddForm
            placeholder="Name, e.g. Maya Chen"
            maxLength={60}
            taken={p.members.map((m) => m.color)}
            onAdd={p.onCreateMember}
          />
        </section>

        <section className="settings__section">
          <h3>
            <TagIcon /> Labels
          </h3>
          <p className="settings__hint">Tag tasks by type or area, then filter the board by label.</p>
          <ul className="settings__list">
            {p.labels.map((l) => (
              <Row
                key={l.id}
                leading={<LabelChip label={l} />}
                usage={p.tasks.filter((t) => t.labelIds.includes(l.id)).length}
                onDelete={() => p.onDeleteLabel(l.id)}
              />
            ))}
            {p.labels.length === 0 && <li className="settings__empty">No labels yet — try Bug, Feature or Design.</li>}
          </ul>
          <AddForm
            placeholder="Label name, e.g. Bug"
            maxLength={30}
            taken={p.labels.map((l) => l.color)}
            onAdd={p.onCreateLabel}
          />
        </section>
      </div>
    </Modal>
  );
}

function Row({
  leading,
  name,
  usage,
  onDelete,
}: {
  leading: ReactNode;
  name?: string;
  usage: number;
  onDelete: () => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="settings__row">
      {leading}
      {name && <span className="settings__name">{name}</span>}
      <span className="settings__usage">
        {usage} {usage === 1 ? 'task' : 'tasks'}
      </span>
      {confirm ? (
        <span className="settings__confirm">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => void onDelete()}>
            Remove
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => setConfirm(true)}
          aria-label={`Remove ${name ?? 'label'}`}
        >
          <TrashIcon size={14} />
        </button>
      )}
    </li>
  );
}

function AddForm({
  placeholder,
  maxLength,
  taken,
  onAdd,
}: {
  placeholder: string;
  maxLength: number;
  taken: string[];
  onAdd: (name: string, color: string) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => randomSwatch(taken));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await onAdd(name, color);
    setBusy(false);
    if (created) {
      setName('');
      setColor(randomSwatch([...taken, color]));
    }
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-form__row">
        <input
          className="input"
          placeholder={placeholder}
          value={name}
          maxLength={maxLength}
          onChange={(e) => setName(e.target.value)}
          aria-label={placeholder}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim() || busy}>
          {busy ? <Spinner /> : <PlusIcon size={14} />} Add
        </button>
      </div>
      <div className="swatches" role="radiogroup" aria-label="Color">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={`Color ${c}`}
            className={`swatch${color === c ? ' is-on' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          >
            {color === c && <CheckIcon size={12} />}
          </button>
        ))}
      </div>
    </form>
  );
}
