export type Status = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null; // YYYY-MM-DD
  position: number;
  created_at: string;
  updated_at: string;
  assigneeIds: string[];
  labelIds: string[];
  commentCount: number;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
}

export type ActivityKind = 'created' | 'status' | 'edited' | 'assigned' | 'unassigned';

export interface Activity {
  id: string;
  task_id: string;
  kind: ActivityKind;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export interface BoardData {
  tasks: Task[];
  members: Member[];
  labels: Label[];
}

export interface TaskDraft {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  assigneeIds: string[];
  labelIds: string[];
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'position'>>;

export interface Filters {
  query: string;
  priorities: Priority[];
  labelIds: string[];
  assigneeIds: string[];
}

export const STATUSES: { id: Status; name: string; hint: string }[] = [
  { id: 'todo', name: 'To Do', hint: 'Ideas and work that is ready to pick up' },
  { id: 'in_progress', name: 'In Progress', hint: 'Someone is actively on it' },
  { id: 'in_review', name: 'In Review', hint: 'Waiting on feedback or QA' },
  { id: 'done', name: 'Done', hint: 'Shipped and wrapped up' },
];

export const STATUS_NAME: Record<Status, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const PRIORITIES: { id: Priority; name: string }[] = [
  { id: 'high', name: 'High' },
  { id: 'normal', name: 'Normal' },
  { id: 'low', name: 'Low' },
];
