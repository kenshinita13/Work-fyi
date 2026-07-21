create index projects_workspace_status_updated_idx
  on public.projects (workspace_id, status, updated_at desc, id);

create index activity_logs_project_timeline_idx
  on public.activity_logs (
    workspace_id,
    resource_type,
    resource_id,
    created_at desc
  );

revoke update on public.projects from authenticated;
grant update (name, description, status) on public.projects to authenticated;

drop policy if exists "Activity logs are insertable by workspace members"
  on public.activity_logs;
revoke insert on public.activity_logs from authenticated;

create or replace function private.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  activity_action text;
  current_actor uuid := (select auth.uid());
begin
  if current_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    activity_action := 'project.created';
  elsif old.status <> 'archived' and new.status = 'archived' then
    activity_action := 'project.archived';
  elsif old.status = 'archived' and new.status <> 'archived' then
    activity_action := 'project.restored';
  else
    activity_action := 'project.updated';
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
    current_actor,
    activity_action,
    'project',
    new.id,
    jsonb_build_object('status', new.status)
  );

  return new;
end;
$$;

revoke all on function private.log_project_activity()
  from public, anon, authenticated;

create trigger log_project_activity
after insert or update on public.projects
for each row execute function private.log_project_activity();
