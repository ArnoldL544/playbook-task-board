import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dueState, formatDue, initials } from '../lib/format';
import type { Label, Member, Priority } from '../types';
import { CalendarIcon, CheckIcon, CloseIcon, PriorityIcon } from './Icons';

/* ----------------------------- Avatars ----------------------------- */

export function Avatar({ member, size = 22 }: { member: Member; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.42 }}
      title={member.name}
    >
      {initials(member.name)}
    </span>
  );
}

export function AvatarStack({ members, max = 3, size = 22 }: { members: Member[]; max?: number; size?: number }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <span className="avatar-stack" aria-label={members.map((m) => m.name).join(', ')}>
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar avatar--more" style={{ width: size, height: size, fontSize: size * 0.42 }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ------------------------------ Chips ------------------------------ */

export function LabelChip({ label, onRemove }: { label: Label; onRemove?: () => void }) {
  return (
    <span className="label-chip" style={{ ['--chip' as string]: label.color }}>
      <span className="label-chip__dot" />
      {label.name}
      {onRemove && (
        <button type="button" className="label-chip__remove" onClick={onRemove} aria-label={`Remove ${label.name}`}>
          <CloseIcon size={10} />
        </button>
      )}
    </span>
  );
}

export function DueBadge({ date, done }: { date: string; done: boolean }) {
  const state = dueState(date, done);
  const text =
    state === 'overdue' ? `Overdue · ${formatDue(date)}` : formatDue(date);
  return (
    <span className={`due due--${done ? 'done' : state}`} title={`Due ${date}`}>
      <CalendarIcon size={12} />
      {text}
    </span>
  );
}

export function PriorityTag({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  const name = priority === 'high' ? 'High' : priority === 'normal' ? 'Normal' : 'Low';
  return (
    <span className={`priority priority--${priority}`} title={`${name} priority`}>
      <PriorityIcon level={priority} />
      {showLabel && <span>{name}</span>}
    </span>
  );
}

/* ------------------------------ Popover ---------------------------- */

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
}

/** Anchored dropdown; closes on outside click and Escape. */
export function Popover({ trigger, children, align = 'start', width = 240 }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="popover-root" ref={root}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div id={id} className={`popover popover--${align}`} style={{ width }} role="dialog">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export interface Option {
  id: string;
  name: string;
  color?: string;
  leading?: ReactNode;
}

/** A checkable list used inside popovers (filters, assignees, labels). */
export function CheckList({
  options,
  selected,
  onToggle,
  empty,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  empty?: ReactNode;
}) {
  if (options.length === 0) return <div className="checklist__empty">{empty ?? 'Nothing here yet.'}</div>;
  return (
    <ul className="checklist" role="listbox" aria-multiselectable="true">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <li key={o.id}>
            <button
              type="button"
              role="option"
              aria-selected={on}
              className={`checklist__item${on ? ' is-on' : ''}`}
              onClick={() => onToggle(o.id)}
            >
              <span className="checklist__box">{on && <CheckIcon size={12} />}</span>
              {o.leading ?? (o.color && <span className="swatch-dot" style={{ background: o.color }} />)}
              <span className="checklist__name">{o.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------- Modal ------------------------------ */

let openModals = 0;

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Runs once per open: focus management, Escape, and scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.modal, .drawer');
      if (all[all.length - 1] === panel.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first field (or the panel) for keyboard users.
    const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not(.modal__close)');
    (first ?? panel.current)?.focus();
    openModals += 1;
    document.body.classList.add('has-modal');
    return () => {
      document.removeEventListener('keydown', onKey);
      openModals -= 1;
      if (openModals === 0) document.body.classList.remove('has-modal');
      prev?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panel}
        tabIndex={-1}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Spinner ----------------------------- */

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}
