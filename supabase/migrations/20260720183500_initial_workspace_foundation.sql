create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12,6),
  status text not null,
  created_at timestamptz not null default now()
);

create index profiles_created_at_idx on public.profiles (created_at);
create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspaces_created_at_idx on public.workspaces (created_at);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_created_at_idx on public.workspace_members (created_at);
create index projects_workspace_id_idx on public.projects (workspace_id);
create index projects_created_at_idx on public.projects (created_at);
create index projects_status_idx on public.projects (status);
create index tasks_workspace_id_idx on public.tasks (workspace_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_parent_task_id_idx on public.tasks (parent_task_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_due_at_idx on public.tasks (status, due_at);
create index tasks_created_at_idx on public.tasks (created_at);
create index task_comments_workspace_id_idx on public.task_comments (workspace_id);
create index task_comments_task_id_idx on public.task_comments (task_id);
create index task_comments_created_at_idx on public.task_comments (created_at);
create index activity_logs_workspace_id_idx on public.activity_logs (workspace_id);
create index activity_logs_created_at_idx on public.activity_logs (created_at);
create index activity_logs_resource_idx on public.activity_logs (resource_type, resource_id);
create index ai_conversations_workspace_id_idx on public.ai_conversations (workspace_id);
create index ai_conversations_created_at_idx on public.ai_conversations (created_at);
create index ai_messages_conversation_id_idx on public.ai_messages (conversation_id);
create index ai_messages_workspace_id_idx on public.ai_messages (workspace_id);
create index ai_messages_created_at_idx on public.ai_messages (created_at);
create index ai_usage_workspace_id_idx on public.ai_usage (workspace_id);
create index ai_usage_created_at_idx on public.ai_usage (created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger set_workspaces_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger set_task_comments_updated_at before update on public.task_comments
for each row execute function public.set_updated_at();
create trigger set_ai_conversations_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace
        and user_id = (select auth.uid())
    );
$$;

create or replace function public.has_workspace_role(target_workspace uuid, accepted_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace
        and user_id = (select auth.uid())
        and role = any(accepted_roles)
    );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;

create policy "Profiles are selectable by owner" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy "Profiles are insertable by owner" on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy "Profiles are updatable by owner" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Profiles are deletable by owner" on public.profiles
for delete to authenticated
using (id = (select auth.uid()));

create policy "Workspaces are selectable by members" on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

create policy "Workspaces are insertable by owner" on public.workspaces
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Workspaces are updatable by admins" on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, array['owner', 'admin']))
with check (public.has_workspace_role(id, array['owner', 'admin']));

create policy "Workspaces are deletable by owners" on public.workspaces
for delete to authenticated
using (public.has_workspace_role(id, array['owner']));

create policy "Workspace members are selectable by workspace members" on public.workspace_members
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members are insertable by admins" on public.workspace_members
for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Workspace members are updatable by owners and admins" on public.workspace_members
for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Workspace members are deletable by owners and admins" on public.workspace_members
for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Projects are selectable by workspace members" on public.projects
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Projects are insertable by contributors" on public.projects
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
);

create policy "Projects are updatable by contributors" on public.projects
for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "Projects are deletable by admins" on public.projects
for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Tasks are selectable by workspace members" on public.tasks
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Tasks are insertable by contributors" on public.tasks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
);

create policy "Tasks are updatable by contributors" on public.tasks
for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']));

create policy "Tasks are deletable by admins" on public.tasks
for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "Task comments are selectable by workspace members" on public.task_comments
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Task comments are insertable by contributors" on public.task_comments
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
);

create policy "Task comments are updatable by authors" on public.task_comments
for update to authenticated
using (
  author_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
)
with check (
  author_id = (select auth.uid())
  and public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])
);

create policy "Task comments are deletable by authors and admins" on public.task_comments
for delete to authenticated
using (
  author_id = (select auth.uid())
  or public.has_workspace_role(workspace_id, array['owner', 'admin'])
);

create policy "Activity logs are selectable by workspace members" on public.activity_logs
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Activity logs are insertable by workspace members" on public.activity_logs
for insert to authenticated
with check (public.is_workspace_member(workspace_id));

create policy "Activity logs are not updatable by users" on public.activity_logs
for update to authenticated
using (false)
with check (false);

create policy "Activity logs are not deletable by users" on public.activity_logs
for delete to authenticated
using (false);

create policy "AI conversations are selectable by workspace members" on public.ai_conversations
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "AI conversations are insertable by owner" on public.ai_conversations
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

create policy "AI conversations are updatable by owner" on public.ai_conversations
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

create policy "AI conversations are deletable by owner" on public.ai_conversations
for delete to authenticated
using (
  user_id = (select auth.uid())
  or public.has_workspace_role(workspace_id, array['owner', 'admin'])
);

create policy "AI messages are selectable by workspace members" on public.ai_messages
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "AI messages are insertable by workspace members" on public.ai_messages
for insert to authenticated
with check (public.is_workspace_member(workspace_id));

create policy "AI messages are not updatable by users" on public.ai_messages
for update to authenticated
using (false)
with check (false);

create policy "AI messages are not deletable by users" on public.ai_messages
for delete to authenticated
using (false);

create policy "AI usage is selectable by workspace admins" on public.ai_usage
for select to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "AI usage is insertable by workspace members" on public.ai_usage
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

create policy "AI usage is not updatable by users" on public.ai_usage
for update to authenticated
using (false)
with check (false);

create policy "AI usage is not deletable by users" on public.ai_usage
for delete to authenticated
using (false);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert on public.ai_usage to authenticated;

grant all on public.profiles to service_role;
grant all on public.workspaces to service_role;
grant all on public.workspace_members to service_role;
grant all on public.projects to service_role;
grant all on public.tasks to service_role;
grant all on public.task_comments to service_role;
grant all on public.activity_logs to service_role;
grant all on public.ai_conversations to service_role;
grant all on public.ai_messages to service_role;
grant all on public.ai_usage to service_role;
