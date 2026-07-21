create index tasks_workspace_status_updated_idx
  on public.tasks (workspace_id, status, updated_at desc, id);

create index tasks_workspace_due_open_idx
  on public.tasks (workspace_id, due_at, id)
  where due_at is not null and status not in ('done', 'cancelled');

create index tasks_workspace_assignee_status_idx
  on public.tasks (workspace_id, assigned_to, status, updated_at desc, id);

create index tasks_workspace_project_updated_idx
  on public.tasks (workspace_id, project_id, updated_at desc, id);

create index task_comments_task_created_idx
  on public.task_comments (task_id, created_at, id);

revoke update, delete on public.tasks from authenticated;
grant update (
  project_id,
  parent_task_id,
  title,
  description,
  status,
  priority,
  assigned_to,
  due_at,
  completed_at
) on public.tasks to authenticated;

revoke update, delete on public.task_comments from authenticated;
grant update (body) on public.task_comments to authenticated;

create or replace function private.shares_workspace_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members peer
        on peer.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid())
        and peer.user_id = target_user
    );
$$;

revoke all on function private.shares_workspace_with(uuid) from public;
grant execute on function private.shares_workspace_with(uuid)
  to authenticated, service_role;

create or replace function public.shares_workspace_with(target_user uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.shares_workspace_with(target_user);
$$;

revoke all on function public.shares_workspace_with(uuid) from public;
grant execute on function public.shares_workspace_with(uuid)
  to authenticated, service_role;

drop policy if exists "Profiles are selectable by owner" on public.profiles;

create policy "Profiles are selectable by owner or workspace peers"
on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.shares_workspace_with(id))
);

create or replace function private.validate_workspace_role_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_actor uuid := (select auth.uid());
  actor_role text;
  workspace_owner uuid;
begin
  if current_actor is null
    and coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  then
    return new;
  end if;

  select owner_id into workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  select role into actor_role
  from public.workspace_members
  where workspace_id = new.workspace_id
    and user_id = current_actor;

  if new.user_id = workspace_owner and new.role <> 'owner' then
    raise exception 'The workspace owner role cannot be changed'
      using errcode = '42501';
  end if;

  if new.role = 'owner' and new.user_id <> workspace_owner then
    raise exception 'Workspace ownership transfer requires a dedicated flow'
      using errcode = '42501';
  end if;

  if actor_role = 'owner' then
    return new;
  end if;

  if actor_role = 'admin'
    and old.role in ('member', 'viewer')
    and new.role in ('member', 'viewer')
  then
    return new;
  end if;

  raise exception 'Insufficient permission to change this workspace role'
    using errcode = '42501';
end;
$$;

revoke all on function private.validate_workspace_role_change()
  from public, anon, authenticated;

create trigger validate_workspace_role_change
before update of role on public.workspace_members
for each row execute function private.validate_workspace_role_change();

create or replace function private.log_workspace_role_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    new.workspace_id,
    (select auth.uid()),
    'member.role_updated',
    'workspace_member',
    new.user_id,
    jsonb_build_object('old_role', old.role, 'new_role', new.role)
  );

  return new;
end;
$$;

revoke all on function private.log_workspace_role_change()
  from public, anon, authenticated;

create trigger log_workspace_role_change
after update of role on public.workspace_members
for each row
when (old.role is distinct from new.role)
execute function private.log_workspace_role_change();

create or replace function private.validate_task_relationships()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.uid()) is null
    and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
  then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.project_id is not null and not exists (
    select 1
    from public.projects
    where id = new.project_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Project must belong to the task workspace'
      using errcode = '23514';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.workspace_members
    where workspace_id = new.workspace_id
      and user_id = new.assigned_to
  ) then
    raise exception 'Assignee must belong to the task workspace'
      using errcode = '23514';
  end if;

  if new.parent_task_id is not null and (
    new.parent_task_id = new.id
    or not exists (
      select 1
      from public.tasks
      where id = new.parent_task_id
        and workspace_id = new.workspace_id
    )
  ) then
    raise exception 'Parent task must belong to the task workspace'
      using errcode = '23514';
  end if;

  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_task_relationships()
  from public, anon, authenticated;

create trigger validate_task_relationships
before insert or update on public.tasks
for each row execute function private.validate_task_relationships();

create or replace function private.validate_task_comment_relationship()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.uid()) is null
    and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
  then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tasks
    where id = new.task_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Comment task must belong to the same workspace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_task_comment_relationship()
  from public, anon, authenticated;

create trigger validate_task_comment_relationship
before insert or update on public.task_comments
for each row execute function private.validate_task_comment_relationship();

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  activity_action text;
begin
  if tg_op = 'INSERT' then
    activity_action := 'task.created';
  elsif old.status <> 'done' and new.status = 'done' then
    activity_action := 'task.completed';
  elsif old.status <> 'cancelled' and new.status = 'cancelled' then
    activity_action := 'task.cancelled';
  elsif old.status in ('done', 'cancelled')
    and new.status not in ('done', 'cancelled') then
    activity_action := 'task.reopened';
  else
    activity_action := 'task.updated';
  end if;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    new.workspace_id,
    coalesce((select auth.uid()), new.created_by),
    activity_action,
    'task',
    new.id,
    jsonb_build_object(
      'status', new.status,
      'priority', new.priority,
      'project_id', new.project_id,
      'assigned_to', new.assigned_to
    )
  );

  return new;
end;
$$;

revoke all on function private.log_task_activity()
  from public, anon, authenticated;

create trigger log_task_activity
after insert or update on public.tasks
for each row execute function private.log_task_activity();

create or replace function private.log_task_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    new.workspace_id,
    coalesce((select auth.uid()), new.author_id),
    case
      when tg_op = 'INSERT' then 'task.comment_added'
      else 'task.comment_updated'
    end,
    'task',
    new.task_id,
    jsonb_build_object('comment_id', new.id)
  );

  return new;
end;
$$;

revoke all on function private.log_task_comment_activity()
  from public, anon, authenticated;

create trigger log_task_comment_activity
after insert or update on public.task_comments
for each row execute function private.log_task_comment_activity();
