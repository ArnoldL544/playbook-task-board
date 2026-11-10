import type { PointerEvent } from 'react';
import type { DragState } from '../hooks/useDragAndDrop';
import type { Label, Member, Status, Task } from '../types';
import { PlusIcon } from './Icons';
import { TaskCard } from './TaskCard';

interface Props {
  status: Status;
  name: string;
  hint: string;
  tasks: Task[]; // already filtered + sorted
  totalCount: number; // before filtering
  members: Member[];
  labels: Label[];
  drag: DragState | null;
  filtering: boolean;
  columnRef: (el: HTMLElement | null) => void;
  listRef: (el: HTMLElement | null) => void;
  onCardPointerDown: (taskId: string, status: Status) => (e: PointerEvent<HTMLElement>) => void;
  onOpen: (id: string) => void;
  onAdd: (status: Status) => void;
}

export function Column({
  status,
  name,
  hint,
  tasks,
  totalCount,
  members,
  labels,
  drag,
  filtering,
  columnRef,
  listRef,
  onCardPointerDown,
  onOpen,
  onAdd,
}: Props) {
  const isTarget = drag?.overStatus === status;
  const visible = drag ? tasks.filter((t) => t.id !== drag.taskId) : tasks;

  const placeholder = (
    <div key="__placeholder" className="card-placeholder" data-placeholder style={{ height: drag?.height }} />
  );

  const items = visible.map((task) => (
    <TaskCard
      key={task.id}
      task={task}
      members={members}
      labels={labels}
      onOpen={onOpen}
      onPointerDown={onCardPointerDown(task.id, status)}
    />
  ));
  if (drag && isTarget) items.splice(Math.min(drag.overIndex, items.length), 0, placeholder);

  const count = filtering ? `${tasks.length}/${totalCount}` : `${totalCount}`;

  return (
    <section
      className={`column column--${status}${isTarget ? ' is-drop-target' : ''}`}
      ref={columnRef}
      aria-label={`${name} column, ${tasks.length} tasks`}
    >
      <header className="column__header">
        <span className="column__dot" aria-hidden="true" />
        <h2 className="column__name">{name}</h2>
        <span className="column__count">{count}</span>
        <button
          type="button"
          className="icon-btn icon-btn--sm column__add"
          onClick={() => onAdd(status)}
          aria-label={`Add task to ${name}`}
          title={`Add task to ${name}`}
        >
          <PlusIcon size={14} />
        </button>
      </header>

      <div className="column__list" ref={listRef}>
        {items}
        {visible.length === 0 && !(drag && isTarget) && (
          <ColumnEmpty status={status} hint={hint} filtering={filtering && totalCount > 0} onAdd={() => onAdd(status)} />
        )}
      </div>
    </section>
  );
}

function ColumnEmpty({
  status,
  hint,
  filtering,
  onAdd,
}: {
  status: Status;
  hint: string;
  filtering: boolean;
  onAdd: () => void;
}) {
  if (filtering) {
    return <div className="column-empty column-empty--quiet">No matching tasks</div>;
  }
  return (
    <div className="column-empty">
      <p>{status === 'done' ? 'Nothing shipped yet' : 'No tasks'}</p>
      <span>{hint}</span>
      {status === 'todo' && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onAdd}>
          <PlusIcon size={14} /> Add a task
        </button>
      )}
    </div>
  );
}

export function ColumnSkeleton({ name, cards }: { name: string; cards: number }) {
  return (
    <section className="column" aria-hidden="true">
      <header className="column__header">
        <span className="column__dot" />
        <h2 className="column__name">{name}</h2>
      </header>
      <div className="column__list">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card card--skeleton">
            <span className="sk sk--line" style={{ width: `${70 - i * 12}%` }} />
            <span className="sk sk--line sk--thin" style={{ width: '45%' }} />
          </div>
        ))}
      </div>
    </section>
  );
}
