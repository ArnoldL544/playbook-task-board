import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Column, ColumnSkeleton } from './components/Column';
import { AlertIcon, MoonIcon, PlusIcon, RefreshIcon, SunIcon, UsersIcon } from './components/Icons';
import { SettingsModal } from './components/SettingsModal';
import { StatsBar } from './components/StatsBar';
import { TaskCard } from './components/TaskCard';
import { TaskDialog } from './components/TaskDialog';
import { TaskDrawer } from './components/TaskDrawer';
import { Toasts, useToasts } from './components/Toasts';
import { Toolbar } from './components/Toolbar';
import { AvatarStack, Popover, Spinner } from './components/ui';
import { useBoard } from './hooks/useBoard';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useTheme } from './hooks/useTheme';
import { positionBetween } from './lib/format';
import { supabaseConfigError } from './lib/supabase';
import { STATUSES, type Filters, type Status, type Task } from './types';

const NO_FILTERS: Filters = { query: '', priorities: [], labelIds: [], assigneeIds: [] };

function matches(task: Task, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !task.title.toLowerCase().includes(q)) return false;
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  if (f.labelIds.length && !task.labelIds.some((id) => f.labelIds.includes(id))) return false;
  if (f.assigneeIds.length && !task.assigneeIds.some((id) => f.assigneeIds.includes(id))) return false;
  return true;
}

export default function App() {
  if (supabaseConfigError) return <ConfigError message={supabaseConfigError} />;
  return <BoardApp />;
}

function BoardApp() {
  const { toasts, notify, dismiss } = useToasts();
  const board = useBoard(notify);
  const { theme, toggleTheme } = useTheme();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [creatingIn, setCreatingIn] = useState<Status | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  /** Per column: all tasks (sorted) and the visible subset after filters. */
  const columns = useMemo(() => {
    const byStatus = {} as Record<Status, { all: Task[]; visible: Task[] }>;
    for (const s of STATUSES) byStatus[s.id] = { all: [], visible: [] };
    const sorted = [...board.tasks].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    for (const t of sorted) {
      byStatus[t.status].all.push(t);
      if (matches(t, filters)) byStatus[t.status].visible.push(t);
    }
    return byStatus;
  }, [board.tasks, filters]);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Turn "dropped at index i of the visible list" into a fractional position.
  const handleDrop = useCallback(
    (taskId: string, status: Status, index: number) => {
      const list = columnsRef.current[status].visible.filter((t) => t.id !== taskId);
      const before = list[index - 1]?.position;
      const after = list[index]?.position;
      board.moveTask(taskId, status, positionBetween(before, after));
    },
    [board.moveTask],
  );

  const dnd = useDragAndDrop({ onDrop: handleDrop });

  const openTask = useCallback(
    (id: string) => {
      if (dnd.shouldSuppressClick()) return;
      setOpenTaskId(id);
    },
    [dnd.shouldSuppressClick],
  );

  // Keyboard shortcuts: "/" focuses search, "n" creates a task.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest('input, textarea, select, [contenteditable="true"]');
      const overlayOpen = document.body.classList.contains('has-modal') || document.querySelector('.drawer');
      if (typing || overlayOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setCreatingIn('todo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openTaskData = openTaskId ? board.tasks.find((t) => t.id === openTaskId) ?? null : null;
  const draggedTask = dnd.drag ? board.tasks.find((t) => t.id === dnd.drag?.taskId) ?? null : null;
  const isEmptyWorkspace =
    board.phase === 'ready' && board.tasks.length === 0 && board.members.length === 0 && board.labels.length === 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand__name">Playbook</span>
          <span className="brand__divider" aria-hidden="true">/</span>
          <span className="brand__board">My workspace</span>
        </div>

        <div className="topbar__right">
          {board.guestId && (
            <Popover
              align="end"
              width={280}
              trigger={({ toggle, open, id }) => (
                <button type="button" className="guest-pill" onClick={toggle} aria-expanded={open} aria-controls={id}>
                  <span className="guest-pill__dot" />
                  Guest · {board.guestId?.slice(0, 4)}
                </button>
              )}
            >
              {(close) => (
                <div className="guest-card">
                  <strong>You're using a guest workspace</strong>
                  <p>
                    No sign-up needed. Your tasks are stored in Supabase under an anonymous account and protected by
                    row-level security — only this browser session can see them.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      close();
                      setOpenTaskId(null);
                      void board.startFresh();
                    }}
                  >
                    <RefreshIcon size={14} /> Start a fresh guest workspace
                  </button>
                </div>
              )}
            </Popover>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="page-head">
          <div>
            <h1>Sprint board</h1>
            <p className="page-head__sub">Plan, track and ship work with your team.</p>
          </div>
          <div className="page-head__actions">
            <button type="button" className="team-btn" onClick={() => setSettingsOpen(true)}>
              {board.members.length > 0 ? <AvatarStack members={board.members} max={4} size={24} /> : <UsersIcon />}
              <span>Team & labels</span>
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setCreatingIn('todo')}
              disabled={board.phase !== 'ready'}
            >
              <PlusIcon size={14} /> New task <kbd className="kbd kbd--on-primary">N</kbd>
            </button>
          </div>
        </div>

        {board.phase === 'ready' && <StatsBar tasks={board.tasks} />}
        {board.phase === 'loading' && <div className="stats stats--loading" aria-hidden="true" />}

        <Toolbar ref={searchRef} filters={filters} onChange={setFilters} members={board.members} labels={board.labels} />

        {isEmptyWorkspace && (
          <div className="welcome">
            <div>
              <strong>Welcome to your board 👋</strong>
              <p>Create your first task, or load a small sample project to explore drag-and-drop, labels, comments and activity.</p>
            </div>
            <div className="welcome__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setCreatingIn('todo')}>
                <PlusIcon size={14} /> New task
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void board.loadSample()} disabled={board.seeding}>
                {board.seeding && <Spinner />} {board.seeding ? 'Loading…' : 'Load sample project'}
              </button>
            </div>
          </div>
        )}

        {board.phase === 'error' ? (
          <div className="board-error" role="alert">
            <AlertIcon size={20} />
            <div>
              <strong>We couldn't load your board</strong>
              <p>{board.loadError}</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={() => void board.reload()}>
              <RefreshIcon size={14} /> Try again
            </button>
          </div>
        ) : (
          <div className="board" ref={dnd.boardRef} aria-busy={board.phase === 'loading'}>
            {board.phase === 'loading'
              ? STATUSES.map((s, i) => <ColumnSkeleton key={s.id} name={s.name} cards={[3, 2, 1, 2][i]} />)
              : STATUSES.map((s) => (
                  <Column
                    key={s.id}
                    status={s.id}
                    name={s.name}
                    hint={s.hint}
                    tasks={columns[s.id].visible}
                    totalCount={columns[s.id].all.length}
                    members={board.members}
                    labels={board.labels}
                    drag={dnd.drag}
                    filtering={filtering}
                    columnRef={dnd.registerColumn(s.id)}
                    listRef={dnd.registerList(s.id)}
                    onCardPointerDown={dnd.onPointerDown}
                    onOpen={openTask}
                    onAdd={setCreatingIn}
                  />
                ))}
          </div>
        )}
      </main>

      {draggedTask && dnd.drag && (
        <div className="drag-overlay" ref={dnd.setOverlay} style={{ width: dnd.drag.width }}>
          <TaskCard task={draggedTask} members={board.members} labels={board.labels} onOpen={() => {}} overlay />
        </div>
      )}

      {creatingIn && (
        <TaskDialog
          initialStatus={creatingIn}
          members={board.members}
          labels={board.labels}
          onCreate={board.createTask}
          onClose={() => setCreatingIn(null)}
          onManage={() => setSettingsOpen(true)}
        />
      )}

      {openTaskData && (
        <TaskDrawer
          task={openTaskData}
          members={board.members}
          labels={board.labels}
          onUpdate={board.updateTask}
          onSetAssignees={board.setAssignees}
          onSetLabels={board.setLabels}
          onDelete={board.deleteTask}
          onCommentCount={board.adjustCommentCount}
          onManage={() => setSettingsOpen(true)}
          onClose={() => setOpenTaskId(null)}
          notify={notify}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          members={board.members}
          labels={board.labels}
          tasks={board.tasks}
          onCreateMember={board.createMember}
          onDeleteMember={board.deleteMember}
          onCreateLabel={board.createLabel}
          onDeleteLabel={board.deleteLabel}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="config-error">
      <AlertIcon size={22} />
      <h1>Supabase isn't configured</h1>
      <p>{message}</p>
    </div>
  );
}
