import * as api from './api';
import { addDaysISO } from './format';
import type { Priority, Status } from '../types';

/**
 * One-click sample project so a first-time visitor (or a reviewer) can see
 * every feature without typing. Everything is written through the same API —
 * and the same RLS policies — as user-created data.
 */
export async function seedSampleProject(): Promise<void> {
  const [maya, jordan, sam] = await Promise.all([
    api.createMember('Maya Chen', '#5b5bd6'),
    api.createMember('Jordan Lee', '#14b8a6'),
    api.createMember('Sam Patel', '#f97316'),
  ]);
  const [feature, bug, design] = await Promise.all([
    api.createLabel('Feature', '#5b5bd6'),
    api.createLabel('Bug', '#ef4444'),
    api.createLabel('Design', '#ec4899'),
  ]);

  const tasks: {
    title: string;
    description?: string;
    status: Status;
    priority: Priority;
    due?: number;
    who: string[];
    tags: string[];
  }[] = [
    {
      title: 'Add soccer offside quiz level',
      description: 'Three short scenarios with animated replays. Players pick onside / offside.',
      status: 'todo',
      priority: 'high',
      due: 5,
      who: [maya.id],
      tags: [feature.id],
    },
    {
      title: 'Write onboarding copy for parents',
      status: 'todo',
      priority: 'normal',
      due: 9,
      who: [sam.id],
      tags: [design.id],
    },
    { title: 'Research leaderboard rewards', status: 'todo', priority: 'low', who: [], tags: [] },
    {
      title: 'Build drag-to-reorder for playbook editor',
      description: 'Coaches should be able to reorder plays within a drill.',
      status: 'in_progress',
      priority: 'high',
      due: 1,
      who: [jordan.id, maya.id],
      tags: [feature.id],
    },
    {
      title: 'Fix score not saving on iOS Safari',
      description: 'Repro: finish a level, background the app, reopen — score resets to 0.',
      status: 'in_progress',
      priority: 'high',
      due: -1,
      who: [jordan.id],
      tags: [bug.id],
    },
    {
      title: 'Redesign player card illustrations',
      status: 'in_review',
      priority: 'normal',
      due: 2,
      who: [sam.id],
      tags: [design.id],
    },
    {
      title: 'Guest accounts with Supabase anonymous auth',
      status: 'done',
      priority: 'normal',
      who: [maya.id],
      tags: [feature.id],
    },
    { title: 'Basketball rules glossary', status: 'done', priority: 'low', who: [sam.id], tags: [] },
  ];

  // Sequential so positions (and activity timestamps) keep the intended order.
  let position = 1024;
  for (const t of tasks) {
    await api.createTask(
      {
        title: t.title,
        description: t.description ?? '',
        status: t.status,
        priority: t.priority,
        due_date: t.due === undefined ? null : addDaysISO(t.due),
        assigneeIds: t.who,
        labelIds: t.tags,
      },
      position,
    );
    position += 1024;
  }
}
