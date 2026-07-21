create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.profiles
  add column primary_role text
    check (primary_role in (
      'virtual_assistant',
      'freelancer',
      'cybersecurity_specialist',
      'project_manager',
      'administrator',
      'other'
    )),
  add column primary_use_case text
    check (primary_use_case in (
      'virtual_assistance',
      'freelancing',
      'cybersecurity',
      'project_management',
      'administration',
      'personal_productivity'
    )),
  add column active_workspace_id uuid
    references public.workspaces(id) on delete set null;

create index profiles_active_workspace_id_idx
  on public.profiles (active_workspace_id);

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members
      where workspace_id = target_workspace
        and user_id = (select auth.uid())
    );
$$;

create or replace function private.has_workspace_role(
  target_workspace uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
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

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, text[]) from public;
grant execute on function private.is_workspace_member(uuid)
  to authenticated, service_role;
grant execute on function private.has_workspace_role(uuid, text[])
  to authenticated, service_role;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.is_workspace_member(target_workspace);
$$;

create or replace function public.has_workspace_role(
  target_workspace uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.has_workspace_role(target_workspace, accepted_roles);
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.is_workspace_member(uuid)
  to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[])
  to authenticated, service_role;

create or replace function private.complete_onboarding(
  input_full_name text,
  input_workspace_name text,
  input_primary_role text,
  input_primary_use_case text,
  input_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_workspace_id uuid;
  new_workspace_id uuid;
  workspace_slug text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(input_full_name)) not between 2 and 100
    or char_length(trim(input_workspace_name)) not between 2 and 80
    or char_length(trim(input_timezone)) not between 1 and 100 then
    raise exception 'Invalid onboarding input' using errcode = '22023';
  end if;

  if input_primary_role not in (
    'virtual_assistant',
    'freelancer',
    'cybersecurity_specialist',
    'project_manager',
    'administrator',
    'other'
  ) or input_primary_use_case not in (
    'virtual_assistance',
    'freelancing',
    'cybersecurity',
    'project_management',
    'administration',
    'personal_productivity'
  ) then
    raise exception 'Invalid onboarding choice' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select workspace_id
    into existing_workspace_id
  from public.workspace_members
  where user_id = current_user_id
  order by created_at
  limit 1;

  if existing_workspace_id is not null then
    insert into public.profiles (
      id,
      full_name,
      timezone,
      primary_role,
      primary_use_case,
      active_workspace_id
    ) values (
      current_user_id,
      trim(input_full_name),
      trim(input_timezone),
      input_primary_role,
      input_primary_use_case,
      existing_workspace_id
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      timezone = excluded.timezone,
      primary_role = excluded.primary_role,
      primary_use_case = excluded.primary_use_case,
      active_workspace_id = excluded.active_workspace_id;

    return existing_workspace_id;
  end if;

  workspace_slug := trim(both '-' from regexp_replace(
    lower(trim(input_workspace_name)),
    '[^a-z0-9]+',
    '-',
    'g'
  ));

  if workspace_slug = '' then
    workspace_slug := 'workspace';
  end if;

  workspace_slug := left(workspace_slug, 48) || '-' ||
    left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.workspaces (name, slug, owner_id)
  values (trim(input_workspace_name), workspace_slug, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  insert into public.profiles (
    id,
    full_name,
    timezone,
    primary_role,
    primary_use_case,
    active_workspace_id
  ) values (
    current_user_id,
    trim(input_full_name),
    trim(input_timezone),
    input_primary_role,
    input_primary_use_case,
    new_workspace_id
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    timezone = excluded.timezone,
    primary_role = excluded.primary_role,
    primary_use_case = excluded.primary_use_case,
    active_workspace_id = excluded.active_workspace_id;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    resource_type,
    resource_id
  ) values (
    new_workspace_id,
    current_user_id,
    'workspace.created',
    'workspace',
    new_workspace_id
  );

  return new_workspace_id;
end;
$$;

revoke all on function private.complete_onboarding(text, text, text, text, text)
  from public;
grant execute on function private.complete_onboarding(text, text, text, text, text)
  to authenticated, service_role;

create or replace function public.complete_onboarding(
  input_full_name text,
  input_workspace_name text,
  input_primary_role text,
  input_primary_use_case text,
  input_timezone text
)
returns uuid
language sql
security invoker
set search_path = pg_catalog
as $$
  select private.complete_onboarding(
    input_full_name,
    input_workspace_name,
    input_primary_role,
    input_primary_use_case,
    input_timezone
  );
$$;

revoke all on function public.complete_onboarding(text, text, text, text, text)
  from public;
grant execute on function public.complete_onboarding(text, text, text, text, text)
  to authenticated, service_role;

drop policy if exists "Workspaces are insertable by owner" on public.workspaces;
revoke insert on public.workspaces from authenticated;
