-- =====================================================================
-- Playbook Task Board — Supabase schema
-- Run this whole file once in Supabase Dashboard → SQL Editor.
-- Every table has Row Level Security enabled; a user (including an
-- anonymous guest) can only read and write rows they own.
-- =====================================================================

-- ---------- Tasks ----------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority    text not null default 'normal'
              check (priority in ('low', 'normal', 'high')),
  due_date    date,
  position    double precision not null default 0,   -- ordering inside a column
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_user_status_position_idx on public.tasks (user_id, status, position);

-- ---------- Team members & assignees ---------------------------------
create table public.members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  color      text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);
create index members_user_idx on public.members (user_id);

create table public.task_assignees (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, member_id)
);
create index task_assignees_member_idx on public.task_assignees (member_id);

-- ---------- Labels ---------------------------------------------------
create table public.labels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  color      text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.task_labels (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  label_id   uuid not null references public.labels(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, label_id)
);
create index task_labels_label_idx on public.task_labels (label_id);

-- ---------- Comments -------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id, created_at);

-- ---------- Activity log (written only by triggers) ------------------
create table public.task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('created', 'status', 'edited', 'assigned', 'unassigned')),
  from_value text,
  to_value   text,
  created_at timestamptz not null default now()
);
create index task_activity_task_idx on public.task_activity (task_id, created_at);

-- =====================================================================
-- Triggers
-- =====================================================================

-- keep tasks.updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- log task creation, status moves and edits
create or replace function public.log_task_activity()
returns trigger language plpgsql set search_path = '' as $$
declare
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, user_id, kind, to_value)
    values (new.id, new.user_id, 'created', new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, user_id, kind, from_value, to_value)
    values (new.id, new.user_id, 'status', old.status, new.status);
  end if;

  if new.title       is distinct from old.title       then changed := array_append(changed, 'title'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.priority    is distinct from old.priority    then changed := array_append(changed, 'priority'); end if;
  if new.due_date    is distinct from old.due_date    then changed := array_append(changed, 'due date'); end if;

  if array_length(changed, 1) > 0 then
    insert into public.task_activity (task_id, user_id, kind, to_value)
    values (new.id, new.user_id, 'edited', array_to_string(changed, ', '));
  end if;

  return new;
end;
$$;

create trigger tasks_log_activity
after insert or update on public.tasks
for each row execute function public.log_task_activity();

-- log assignment changes (skipped when the whole task is being deleted)
create or replace function public.log_assignee_activity()
returns trigger language plpgsql set search_path = '' as $$
declare
  member_name text;
  rec record;
begin
  if tg_op = 'INSERT' then rec := new; else rec := old; end if;

  if not exists (select 1 from public.tasks where id = rec.task_id) then
    return null;
  end if;

  select name into member_name from public.members where id = rec.member_id;

  -- the member itself was deleted: nothing meaningful to log
  if member_name is null then
    return null;
  end if;

  insert into public.task_activity (task_id, user_id, kind, to_value)
  values (rec.task_id, rec.user_id,
          case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end,
          member_name);
  return null;
end;
$$;

create trigger task_assignees_log_activity
after insert or delete on public.task_assignees
for each row execute function public.log_assignee_activity();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.tasks          enable row level security;
alter table public.members        enable row level security;
alter table public.task_assignees enable row level security;
alter table public.labels         enable row level security;
alter table public.task_labels    enable row level security;
alter table public.comments       enable row level security;
alter table public.task_activity  enable row level security;

-- tasks
create policy "tasks: select own" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tasks: insert own" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "tasks: update own" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks: delete own" on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- members
create policy "members: select own" on public.members for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "members: insert own" on public.members for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "members: update own" on public.members for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "members: delete own" on public.members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- labels
create policy "labels: select own" on public.labels for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "labels: insert own" on public.labels for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "labels: update own" on public.labels for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "labels: delete own" on public.labels for delete to authenticated
  using ((select auth.uid()) = user_id);

-- task_assignees: both the task and the member must belong to the caller
create policy "task_assignees: select own" on public.task_assignees for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "task_assignees: insert own" on public.task_assignees for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tasks t   where t.id = task_id   and t.user_id = (select auth.uid()))
    and exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  );
create policy "task_assignees: delete own" on public.task_assignees for delete to authenticated
  using ((select auth.uid()) = user_id);

-- task_labels: both the task and the label must belong to the caller
create policy "task_labels: select own" on public.task_labels for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "task_labels: insert own" on public.task_labels for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tasks t  where t.id = task_id  and t.user_id = (select auth.uid()))
    and exists (select 1 from public.labels l where l.id = label_id and l.user_id = (select auth.uid()))
  );
create policy "task_labels: delete own" on public.task_labels for delete to authenticated
  using ((select auth.uid()) = user_id);

-- comments: only on the caller's own tasks
create policy "comments: select own" on public.comments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "comments: insert own" on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  );
create policy "comments: delete own" on public.comments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- task_activity: read-only for clients (rows are inserted by the triggers
-- above, which run as the calling user, so an insert policy is required;
-- there is deliberately no update or delete policy — the log is append-only)
create policy "task_activity: select own" on public.task_activity for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "task_activity: insert own" on public.task_activity for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  );
