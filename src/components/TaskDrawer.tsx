import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../lib/api';
import { LOCALE, timeAgo } from '../lib/format';
import { STATUS_NAME, type Activity, type Comment, type Label, type Member, type Status, type Task, type TaskPatch } from '../types';
import type { Notify } from '../hooks/useBoard';
import { ActivityIcon, AlertIcon, CloseIcon, CommentIcon, TrashIcon } from './Icons';
import { AssigneePicker, DueDateField, LabelPicker, PrioritySegment, StatusSelect } from './fields';
import { DueBadge, Spinner } from './ui';

interface Props {
  task: Task;
  members: Member[];
  labels: Label[];
  onUpdate: (id: string, patch: TaskPatch) => Promise<boolean>;
  onSetAssignees: (id: string, ids: string[]) => Promise<boolean>;
  onSetLabels: (id: string, ids: string[]) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCommentCount: (id: string, delta: number) => void;
  onManage: () => void;
  onClose: () => void;
  notify: Notify;
}

export function TaskDrawer(props: Props) {
  const { task, members, labels, onUpdate, onSetAssignees, onSetLabels, onDelete, onManage, onClose } = props;
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.modal, .drawer');
      if (all[all.length - 1] === panel.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

  useEffect(() => setConfirmDelete(false), [task.id]);

  return createPortal(
    <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Task details">
        <header className="drawer__header">
          <StatusSelect value={task.status} onChange={(status: Status) => void onUpdate(task.id, { status })} />
          <span className="drawer__created">Created {timeAgo(task.created_at)}</span>
          <div className="drawer__actions">
            {confirmDelete ? (
              <>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={async () => {
                    if (await onDelete(task.id)) onClose();
                  }}
                >
                  Delete task
                </button>
              </>
            ) : (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete task"
                title="Delete task"
              >
                <TrashIcon />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="drawer__body">
          <EditableTitle key={`t-${task.id}`} value={task.title} onSave={(title) => onUpdate(task.id, { title })} />
          <EditableDescription
            key={`d-${task.id}`}
            value={task.description ?? ''}
            onSave={(description) => onUpdate(task.id, { description: description || null })}
          />

          <dl className="props">
            <dt>Priority</dt>
            <dd>
              <PrioritySegment value={task.priority} onChange={(priority) => void onUpdate(task.id, { priority })} />
            </dd>

            <dt>Due date</dt>
            <dd>
              <DueDateField value={task.due_date} onChange={(due_date) => void onUpdate(task.id, { due_date })} />
              {task.due_date && (
                <div className="props__due">
                  <DueBadge date={task.due_date} done={task.status === 'done'} />
                </div>
              )}
            </dd>

            <dt>Assignees</dt>
            <dd>
              <AssigneePicker
                members={members}
                value={task.assigneeIds}
                onChange={(ids) => void onSetAssignees(task.id, ids)}
                onManage={onManage}
              />
            </dd>

            <dt>Labels</dt>
            <dd>
              <LabelPicker
                labels={labels}
                value={task.labelIds}
                onChange={(ids) => void onSetLabels(task.id, ids)}
                onManage={onManage}
              />
            </dd>
          </dl>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'comments'}
              className={`tab${tab === 'comments' ? ' is-on' : ''}`}
              onClick={() => setTab('comments')}
            >
              <CommentIcon size={14} /> Comments
              {task.commentCount > 0 && <span className="tab__count">{task.commentCount}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'activity'}
              className={`tab${tab === 'activity' ? ' is-on' : ''}`}
              onClick={() => setTab('activity')}
            >
              <ActivityIcon size={14} /> Activity
            </button>
          </div>

          {tab === 'comments' ? (
            <Comments task={task} onCommentCount={props.onCommentCount} notify={props.notify} />
          ) : (
            <ActivityLog task={task} />
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

/* ---------------------------- inline edits --------------------------- */

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setText(value), [value]);
  useEffect(() => autosize(ref.current), [text]);

  const commit = () => {
    const next = text.trim();
    if (!next) return setText(value); // titles are required — revert
    if (next !== value) void onSave(next);
  };

  return (
    <textarea
      ref={ref}
      className="drawer__title"
      value={text}
      rows={1}
      maxLength={200}
      aria-label="Task title"
      onChange={(e) => setText(e.target.value.replace(/\n/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          setText(value);
          requestAnimationFrame(() => ref.current?.blur());
        }
      }}
    />
  );
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setText(value), [value]);
  useEffect(() => autosize(ref.current), [text]);

  return (
    <textarea
      ref={ref}
      className="drawer__desc"
      placeholder="Add a description…"
      value={text}
      rows={2}
      maxLength={5000}
      aria-label="Description"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value.trim() && void onSave(text.trim())}
    />
  );
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/* ------------------------------ comments ----------------------------- */

function Comments({
  task,
  onCommentCount,
  notify,
}: {
  task: Task;
  onCommentCount: (id: string, delta: number) => void;
  notify: Notify;
}) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.fetchComments(task.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load comments.');
    }
  }, [task.id]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  const post = async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const c = await api.addComment(task.id, text);
      setItems((list) => [...(list ?? []), c]);
      setBody('');
      onCommentCount(task.id, 1);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not post the comment.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    const before = items;
    setItems((list) => (list ?? []).filter((c) => c.id !== id));
    onCommentCount(task.id, -1);
    try {
      await api.deleteComment(id);
    } catch (e) {
      setItems(before);
      onCommentCount(task.id, 1);
      notify(e instanceof Error ? e.message : 'Could not delete the comment.', 'error');
    }
  };

  return (
    <section className="feed" aria-label="Comments">
      {error ? (
        <InlineError message={error} onRetry={load} />
      ) : items === null ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <p className="feed__empty">No comments yet. Start the conversation below.</p>
      ) : (
        <ol className="comments">
          {items.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment__head">
                <span className="comment__author">You</span>
                <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString(LOCALE)}>
                  {timeAgo(c.created_at)}
                </time>
                <button type="button" className="comment__delete" onClick={() => remove(c.id)} aria-label="Delete comment">
                  <TrashIcon size={12} />
                </button>
              </div>
              <p className="comment__body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void post();
        }}
      >
        <textarea
          className="input input--area"
          rows={2}
          placeholder="Write a comment…"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void post();
            }
          }}
          aria-label="New comment"
        />
        <div className="composer__row">
          <span className="modal__hint">
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd>
          </span>
          <button type="submit" className="btn btn--primary btn--sm" disabled={!body.trim() || posting}>
            {posting && <Spinner size={12} />} Comment
          </button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------ activity ----------------------------- */

function describe(a: Activity): ReactNode {
  const status = (s: string | null) => (s && s in STATUS_NAME ? STATUS_NAME[s as Status] : s ?? '');
  switch (a.kind) {
    case 'created':
      return (
        <>
          Created this task in <b>{status(a.to_value)}</b>
        </>
      );
    case 'status':
      return (
        <>
          Moved from <b>{status(a.from_value)}</b> → <b>{status(a.to_value)}</b>
        </>
      );
    case 'edited':
      return <>Updated {a.to_value}</>;
    case 'assigned':
      return (
        <>
          Assigned <b>{a.to_value}</b>
        </>
      );
    case 'unassigned':
      return (
        <>
          Unassigned <b>{a.to_value}</b>
        </>
      );
  }
}

function ActivityLog({ task }: { task: Task }) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch whenever something that the database logs has changed.
  const signature = [task.id, task.status, task.title, task.description, task.priority, task.due_date, task.assigneeIds.join()].join('|');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.fetchActivity(task.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity.');
    }
  }, [task.id]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 350); // let the write land first
    return () => window.clearTimeout(t);
  }, [signature, load]);

  if (error) return <InlineError message={error} onRetry={load} />;
  if (items === null) return <FeedSkeleton />;
  if (items.length === 0) return <p className="feed__empty">No activity yet.</p>;

  return (
    <ol className="timeline" aria-label="Activity">
      {items.map((a) => (
        <li key={a.id} className={`timeline__item timeline__item--${a.kind}`}>
          <span className="timeline__dot" aria-hidden="true" />
          <span className="timeline__text">{describe(a)}</span>
          <time className="timeline__time" dateTime={a.created_at} title={new Date(a.created_at).toLocaleString(LOCALE)}>
            {timeAgo(a.created_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------- shared ------------------------------ */

function FeedSkeleton() {
  return (
    <div className="feed__skeleton" aria-label="Loading">
      <span className="sk sk--line" style={{ width: '70%' }} />
      <span className="sk sk--line" style={{ width: '50%' }} />
      <span className="sk sk--line" style={{ width: '60%' }} />
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="inline-error" role="alert">
      <AlertIcon />
      <span>{message}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
