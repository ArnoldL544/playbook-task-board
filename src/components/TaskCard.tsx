import { memo, type PointerEvent } from 'react';
import { dueState } from '../lib/format';
import type { Label, Member, Task } from '../types';
import { CommentIcon } from './Icons';
import { AvatarStack, DueBadge, LabelChip, PriorityTag } from './ui';

interface Props {
  task: Task;
  members: Member[];
  labels: Label[];
  onOpen: (id: string) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  overlay?: boolean;
}

function TaskCardBase({ task, members, labels, onOpen, onPointerDown, overlay }: Props) {
  const done = task.status === 'done';
  const assignees = members.filter((m) => task.assigneeIds.includes(m.id));
  const taskLabels = labels.filter((l) => task.labelIds.includes(l.id));
  const urgency = dueState(task.due_date, done);
  const hasMeta = task.due_date || task.commentCount > 0 || assignees.length > 0;

  return (
    <article
      className={[
        'card',
        overlay ? 'card--overlay' : '',
        done ? 'card--done' : '',
        urgency === 'overdue' ? 'card--overdue' : '',
      ].join(' ')}
      data-task-id={overlay ? undefined : task.id}
      onPointerDown={onPointerDown}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
      tabIndex={overlay ? -1 : 0}
      role="button"
      aria-label={`${task.title}. Open task details`}
    >
      {taskLabels.length > 0 && (
        <div className="card__labels">
          {taskLabels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}

      <div className="card__title-row">
        <PriorityTag priority={task.priority} />
        <h3 className="card__title">{task.title}</h3>
      </div>

      {task.description && <p className="card__desc">{task.description}</p>}

      {hasMeta && (
        <div className="card__meta">
          {task.due_date && <DueBadge date={task.due_date} done={done} />}
          {task.commentCount > 0 && (
            <span className="card__comments" title={`${task.commentCount} comments`}>
              <CommentIcon size={12} />
              {task.commentCount}
            </span>
          )}
          <span className="card__spacer" />
          <AvatarStack members={assignees} size={20} />
        </div>
      )}
    </article>
  );
}

export const TaskCard = memo(TaskCardBase);
