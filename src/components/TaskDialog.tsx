import { useState, type FormEvent } from 'react';
import type { Label, Member, Status, Task, TaskDraft } from '../types';
import { AssigneePicker, DueDateField, LabelPicker, PrioritySegment, StatusSelect } from './fields';
import { Modal, Spinner } from './ui';

interface Props {
  initialStatus: Status;
  members: Member[];
  labels: Label[];
  onCreate: (draft: TaskDraft) => Promise<Task | null>;
  onClose: () => void;
  onManage: () => void;
}

export function TaskDialog({ initialStatus, members, labels, onCreate, onClose, onManage }: Props) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: '',
    description: '',
    status: initialStatus,
    priority: 'normal',
    due_date: null,
    assigneeIds: [],
    labelIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const titleError = touched && draft.title.trim() === '' ? 'Give the task a title.' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (draft.title.trim() === '' || saving) return;
    setSaving(true);
    const created = await onCreate(draft);
    setSaving(false);
    if (created) onClose();
  };

  return (
    <Modal
      title="New task"
      onClose={onClose}
      footer={
        <>
          <span className="modal__hint">
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd> to create
          </span>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-task-form" className="btn btn--primary" disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </>
      }
    >
      <form
        id="new-task-form"
        className="form"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
        noValidate
      >
        <div className="field">
          <input
            className={`input input--title${titleError ? ' is-invalid' : ''}`}
            placeholder="Task title"
            value={draft.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
            onBlur={() => draft.title && setTouched(true)}
            aria-label="Title"
            aria-invalid={!!titleError}
            aria-describedby={titleError ? 'title-error' : undefined}
          />
          {titleError && (
            <span id="title-error" className="field__error">
              {titleError}
            </span>
          )}
        </div>

        <div className="field">
          <textarea
            className="input input--area"
            placeholder="Add a description…"
            rows={3}
            maxLength={5000}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            aria-label="Description"
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="new-status">Status</label>
            <StatusSelect id="new-status" value={draft.status} onChange={(s) => set('status', s)} />
          </div>
          <div className="field">
            <span className="field__label">Priority</span>
            <PrioritySegment value={draft.priority} onChange={(p) => set('priority', p)} />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="new-due">Due date</label>
          <DueDateField id="new-due" value={draft.due_date} onChange={(d) => set('due_date', d)} />
        </div>

        <div className="form-grid">
          <div className="field">
            <span className="field__label">Assignees</span>
            <AssigneePicker
              members={members}
              value={draft.assigneeIds}
              onChange={(ids) => set('assigneeIds', ids)}
              onManage={onManage}
            />
          </div>
          <div className="field">
            <span className="field__label">Labels</span>
            <LabelPicker
              labels={labels}
              value={draft.labelIds}
              onChange={(ids) => set('labelIds', ids)}
              onManage={onManage}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
