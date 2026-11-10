import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import { positionBetween } from '../lib/format';
import { seedSampleProject } from '../lib/sample';
import type { BoardData, Label, Member, Status, Task, TaskDraft, TaskPatch } from '../types';

export type Phase = 'loading' | 'ready' | 'error';
export type Notify = (message: string, tone?: 'error' | 'success' | 'info') => void;

const EMPTY: BoardData = { tasks: [], members: [], labels: [] };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/**
 * Owns the board state. Every mutation is optimistic: the UI updates
 * immediately, the request goes to Supabase, and on failure the previous
 * state is restored and a toast explains what happened.
 */
export function useBoard(notify: Notify) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [data, setData] = useState<BoardData>(EMPTY);

  // Latest state for rollbacks without stale closures.
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async (fresh = false) => {
    setPhase('loading');
    setLoadError(null);
    try {
      const session = fresh ? await api.startFreshGuest() : await api.ensureGuestSession();
      setGuestId(session.user.id);
      const board = await api.fetchBoard();
      setData(board);
      setPhase('ready');
    } catch (err) {
      setLoadError(errorMessage(err));
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Apply a local change now; run `request`; roll back on failure. */
  const optimistic = useCallback(
    async (apply: (d: BoardData) => BoardData, request: () => Promise<void>) => {
      const snapshot = dataRef.current;
      setData(apply);
      try {
        await request();
        return true;
      } catch (err) {
        setData(snapshot);
        notify(errorMessage(err), 'error');
        return false;
      }
    },
    [notify],
  );

  const patchTaskLocal = (id: string, patch: Partial<Task>) => (d: BoardData): BoardData => ({
    ...d,
    tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  });

  /* ----------------------------- tasks ----------------------------- */

  const createTask = useCallback(
    async (draft: TaskDraft) => {
      // New tasks land at the top of their column.
      const column = dataRef.current.tasks
        .filter((t) => t.status === draft.status)
        .sort((a, b) => a.position - b.position);
      const position = positionBetween(undefined, column[0]?.position);
      try {
        const task = await api.createTask(draft, position);
        setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
        return task;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return null;
      }
    },
    [notify],
  );

  const moveTask = useCallback(
    (id: string, status: Status, position: number) => {
      const current = dataRef.current.tasks.find((t) => t.id === id);
      if (!current || (current.status === status && current.position === position)) return;
      void optimistic(patchTaskLocal(id, { status, position }), () =>
        api.updateTask(id, { status, position }),
      );
    },
    [optimistic],
  );

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      let finalPatch = patch;
      // Changing status from the detail panel moves the card to the bottom of the new column.
      if (patch.status) {
        const current = dataRef.current.tasks.find((t) => t.id === id);
        if (current && current.status !== patch.status) {
          const column = dataRef.current.tasks
            .filter((t) => t.status === patch.status)
            .sort((a, b) => a.position - b.position);
          finalPatch = { ...patch, position: positionBetween(column[column.length - 1]?.position, undefined) };
        }
      }
      return optimistic(patchTaskLocal(id, finalPatch), () => api.updateTask(id, finalPatch));
    },
    [optimistic],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const ok = await optimistic(
        (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }),
        () => api.deleteTask(id),
      );
      if (ok) notify('Task deleted', 'success');
      return ok;
    },
    [optimistic, notify],
  );

  const setAssignees = useCallback(
    (id: string, next: string[]) => {
      const prev = dataRef.current.tasks.find((t) => t.id === id)?.assigneeIds ?? [];
      return optimistic(patchTaskLocal(id, { assigneeIds: next }), () => api.setAssignees(id, prev, next));
    },
    [optimistic],
  );

  const setLabels = useCallback(
    (id: string, next: string[]) => {
      const prev = dataRef.current.tasks.find((t) => t.id === id)?.labelIds ?? [];
      return optimistic(patchTaskLocal(id, { labelIds: next }), () => api.setLabels(id, prev, next));
    },
    [optimistic],
  );

  const adjustCommentCount = useCallback((id: string, delta: number) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === id ? { ...t, commentCount: Math.max(0, t.commentCount + delta) } : t,
      ),
    }));
  }, []);

  /* ------------------------ members & labels ----------------------- */

  const createMember = useCallback(
    async (name: string, color: string): Promise<Member | null> => {
      try {
        const member = await api.createMember(name, color);
        setData((d) => ({ ...d, members: [...d.members, member] }));
        return member;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return null;
      }
    },
    [notify],
  );

  const deleteMember = useCallback(
    (id: string) =>
      optimistic(
        (d) => ({
          ...d,
          members: d.members.filter((m) => m.id !== id),
          tasks: d.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) })),
        }),
        () => api.deleteMember(id),
      ),
    [optimistic],
  );

  const createLabel = useCallback(
    async (name: string, color: string): Promise<Label | null> => {
      try {
        const label = await api.createLabel(name, color);
        setData((d) => ({ ...d, labels: [...d.labels, label] }));
        return label;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return null;
      }
    },
    [notify],
  );

  const deleteLabel = useCallback(
    (id: string) =>
      optimistic(
        (d) => ({
          ...d,
          labels: d.labels.filter((l) => l.id !== id),
          tasks: d.tasks.map((t) => ({ ...t, labelIds: t.labelIds.filter((l) => l !== id) })),
        }),
        () => api.deleteLabel(id),
      ),
    [optimistic],
  );

  const [seeding, setSeeding] = useState(false);
  const loadSample = useCallback(async () => {
    setSeeding(true);
    try {
      await seedSampleProject();
      setData(await api.fetchBoard());
      notify('Sample project loaded', 'success');
    } catch (err) {
      notify(errorMessage(err), 'error');
      // Show whatever did get created.
      try {
        setData(await api.fetchBoard());
      } catch {
        /* the toast above already explains the failure */
      }
    } finally {
      setSeeding(false);
    }
  }, [notify]);

  return {
    phase,
    seeding,
    loadSample,
    loadError,
    guestId,
    ...data,
    reload: () => load(false),
    startFresh: () => load(true),
    createTask,
    moveTask,
    updateTask,
    deleteTask,
    setAssignees,
    setLabels,
    adjustCommentCount,
    createMember,
    deleteMember,
    createLabel,
    deleteLabel,
  };
}

export type Board = ReturnType<typeof useBoard>;
