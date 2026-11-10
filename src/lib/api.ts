import type { PostgrestError, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  Activity,
  BoardData,
  Comment,
  Label,
  Member,
  Status,
  Task,
  TaskDraft,
  TaskPatch,
} from '../types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {}

function fail(action: string, error: PostgrestError | { message: string }): never {
  throw new ApiError(`Couldn't ${action}: ${error.message}`);
}

const TASK_COLUMNS =
  'id, title, description, status, priority, due_date, position, created_at, updated_at, ' +
  'task_assignees(member_id), task_labels(label_id), comments(count)';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Task['priority'];
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  task_assignees?: { member_id: string }[];
  task_labels?: { label_id: string }[];
  comments?: { count: number }[];
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assigneeIds: (row.task_assignees ?? []).map((a) => a.member_id),
    labelIds: (row.task_labels ?? []).map((l) => l.label_id),
    commentCount: row.comments?.[0]?.count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Auth — anonymous guest sessions                                     */
/* ------------------------------------------------------------------ */

let inflight: Promise<Session> | null = null;

/**
 * Returns the existing guest session, or silently creates one on first launch.
 * Concurrent callers share one request so we never create two guests at once
 * (React StrictMode runs effects twice in development).
 */
export function ensureGuestSession(): Promise<Session> {
  inflight ??= resolveGuestSession().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function resolveGuestSession(): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error) fail('restore your session', error);
  if (data.session) return data.session;

  const signIn = await supabase.auth.signInAnonymously();
  if (signIn.error) {
    if (/anonymous/i.test(signIn.error.message)) {
      throw new ApiError(
        'Guest sign-in is disabled for this Supabase project. Enable "Allow anonymous sign-ins" under Authentication → Sign In / Providers.',
      );
    }
    fail('start a guest session', signIn.error);
  }
  if (!signIn.data.session) throw new ApiError("Couldn't start a guest session.");
  return signIn.data.session;
}

/** Signs out and immediately starts a brand new, empty guest workspace. */
export async function startFreshGuest(): Promise<Session> {
  await supabase.auth.signOut();
  return ensureGuestSession();
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export async function fetchBoard(): Promise<BoardData> {
  const [tasks, members, labels] = await Promise.all([
    supabase.from('tasks').select(TASK_COLUMNS).order('position', { ascending: true }),
    supabase.from('members').select('id, name, color, created_at').order('created_at'),
    supabase.from('labels').select('id, name, color, created_at').order('created_at'),
  ]);
  if (tasks.error) fail('load tasks', tasks.error);
  if (members.error) fail('load team members', members.error);
  if (labels.error) fail('load labels', labels.error);

  return {
    tasks: (tasks.data as unknown as TaskRow[]).map(toTask),
    members: members.data as Member[],
    labels: labels.data as Label[],
  };
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export async function createTask(draft: TaskDraft, position: number): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      priority: draft.priority,
      due_date: draft.due_date,
      position,
    })
    .select('id')
    .single();
  if (error) fail('create the task', error);

  const taskId = (data as { id: string }).id;
  await Promise.all([
    addAssignees(taskId, draft.assigneeIds),
    addLabels(taskId, draft.labelIds),
  ]);
  return fetchTask(taskId);
}

export async function fetchTask(id: string): Promise<Task> {
  const { data, error } = await supabase.from('tasks').select(TASK_COLUMNS).eq('id', id).single();
  if (error) fail('load the task', error);
  return toTask(data as unknown as TaskRow);
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) fail('save your changes', error);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) fail('delete the task', error);
}

async function addAssignees(taskId: string, memberIds: string[]) {
  if (memberIds.length === 0) return;
  const { error } = await supabase
    .from('task_assignees')
    .insert(memberIds.map((member_id) => ({ task_id: taskId, member_id })));
  if (error) fail('assign team members', error);
}

async function addLabels(taskId: string, labelIds: string[]) {
  if (labelIds.length === 0) return;
  const { error } = await supabase
    .from('task_labels')
    .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })));
  if (error) fail('add labels', error);
}

/** Makes the task's assignees exactly `next`, inserting/deleting only the difference. */
export async function setAssignees(taskId: string, prev: string[], next: string[]): Promise<void> {
  const added = next.filter((id) => !prev.includes(id));
  const removed = prev.filter((id) => !next.includes(id));
  await addAssignees(taskId, added);
  if (removed.length > 0) {
    const { error } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .in('member_id', removed);
    if (error) fail('unassign team members', error);
  }
}

/** Makes the task's labels exactly `next`, inserting/deleting only the difference. */
export async function setLabels(taskId: string, prev: string[], next: string[]): Promise<void> {
  const added = next.filter((id) => !prev.includes(id));
  const removed = prev.filter((id) => !next.includes(id));
  await addLabels(taskId, added);
  if (removed.length > 0) {
    const { error } = await supabase
      .from('task_labels')
      .delete()
      .eq('task_id', taskId)
      .in('label_id', removed);
    if (error) fail('remove labels', error);
  }
}

/* ------------------------------------------------------------------ */
/* Team members & labels                                               */
/* ------------------------------------------------------------------ */

export async function createMember(name: string, color: string): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({ name: name.trim(), color })
    .select('id, name, color, created_at')
    .single();
  if (error) fail('add the team member', error);
  return data as Member;
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) fail('remove the team member', error);
}

export async function createLabel(name: string, color: string): Promise<Label> {
  const { data, error } = await supabase
    .from('labels')
    .insert({ name: name.trim(), color })
    .select('id, name, color, created_at')
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError(`A label called "${name.trim()}" already exists.`);
    fail('create the label', error);
  }
  return data as Label;
}

export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase.from('labels').delete().eq('id', id);
  if (error) fail('delete the label', error);
}

/* ------------------------------------------------------------------ */
/* Comments & activity                                                 */
/* ------------------------------------------------------------------ */

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, task_id, body, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) fail('load comments', error);
  return data as Comment[];
}

export async function addComment(taskId: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ task_id: taskId, body: body.trim() })
    .select('id, task_id, body, created_at')
    .single();
  if (error) fail('post the comment', error);
  return data as Comment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) fail('delete the comment', error);
}

export async function fetchActivity(taskId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('task_activity')
    .select('id, task_id, kind, from_value, to_value, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) fail('load activity', error);
  return data as Activity[];
}
