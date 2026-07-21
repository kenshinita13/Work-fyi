create table public.ai_task_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  mode text not null check (mode in ('task_plan', 'subtasks')),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_task_plan_drafts_mode_parent_check check (
    (mode = 'task_plan' and parent_task_id is null)
    or (mode = 'subtasks' and parent_task_id is not null)
  )
);

create index ai_task_plan_drafts_user_created_idx
on public.ai_task_plan_drafts (user_id, created_at desc);

create index ai_task_plan_drafts_workspace_status_idx
on public.ai_task_plan_drafts (workspace_id, status, expires_at);

create index ai_task_plan_drafts_project_id_idx
on public.ai_task_plan_drafts (project_id)
where project_id is not null;

create index ai_task_plan_drafts_parent_task_id_idx
on public.ai_task_plan_drafts (parent_task_id)
where parent_task_id is not null;

create index ai_usage_user_created_idx
on public.ai_usage (user_id, feature, created_at desc);

create index ai_usage_workspace_feature_created_idx
on public.ai_usage (workspace_id, feature, created_at desc);

alter table public.ai_usage
  add constraint ai_usage_feature_check check (char_length(feature) between 1 and 100),
  add constraint ai_usage_status_check check (status in ('started', 'completed', 'failed')),
  add constraint ai_usage_tokens_check check (input_tokens >= 0 and output_tokens >= 0);

alter table public.ai_task_plan_drafts enable row level security;

revoke all on public.ai_task_plan_drafts from anon, authenticated;
grant all on public.ai_task_plan_drafts to service_role;

drop policy if exists "AI usage is insertable by workspace members" on public.ai_usage;
revoke insert, update, delete on public.ai_usage from authenticated;

create or replace function public.enforce_ai_task_plan_draft_relationships()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_project_id uuid;
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects
    where id = new.project_id
      and workspace_id = new.workspace_id
      and status <> 'archived'
  ) then
    raise exception 'AI draft project must belong to its workspace.';
  end if;

  if new.parent_task_id is not null then
    select project_id
    into parent_project_id
    from public.tasks
    where id = new.parent_task_id
      and workspace_id = new.workspace_id;

    if not found then
      raise exception 'AI draft parent task must belong to its workspace.';
    end if;

    if new.project_id is not null
      and parent_project_id is not null
      and new.project_id <> parent_project_id then
      raise exception 'AI draft project must match the parent task project.';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_ai_task_plan_draft_relationships
before insert or update of workspace_id, project_id, parent_task_id
on public.ai_task_plan_drafts
for each row execute function public.enforce_ai_task_plan_draft_relationships();

revoke execute on function public.enforce_ai_task_plan_draft_relationships()
from public, anon, authenticated, service_role;

create or replace function public.reserve_ai_task_plan_usage(
  input_workspace_id uuid,
  input_user_id uuid,
  input_model text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  usage_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = input_workspace_id
      and user_id = input_user_id
      and role in ('owner', 'admin', 'member')
  ) then
    raise exception 'AI workspace access denied.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(input_workspace_id::text, 90421));

  if (
    select count(*)
    from public.ai_usage
    where user_id = input_user_id
      and feature = 'task_plan'
      and created_at >= now() - interval '1 minute'
  ) >= 5 then
    raise exception 'AI_RATE_LIMIT';
  end if;

  if (
    select count(*)
    from public.ai_usage
    where workspace_id = input_workspace_id
      and feature = 'task_plan'
      and created_at >= date_trunc('day', now())
  ) >= 100 then
    raise exception 'AI_QUOTA_EXCEEDED';
  end if;

  insert into public.ai_usage (
    workspace_id,
    user_id,
    feature,
    model,
    status
  ) values (
    input_workspace_id,
    input_user_id,
    'task_plan',
    left(input_model, 200),
    'started'
  )
  returning id into usage_id;

  return usage_id;
end;
$$;

revoke execute on function public.reserve_ai_task_plan_usage(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.reserve_ai_task_plan_usage(uuid, uuid, text)
to service_role;

create or replace function public.is_valid_ai_plan_item(
  input_item jsonb,
  require_subtasks boolean
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  due_days numeric;
begin
  if jsonb_typeof(input_item) <> 'object'
    or jsonb_typeof(input_item -> 'title') <> 'string'
    or char_length(btrim(input_item ->> 'title')) not between 2 and 160
    or jsonb_typeof(input_item -> 'description') <> 'string'
    or char_length(input_item ->> 'description') > 2000
    or jsonb_typeof(input_item -> 'priority') <> 'string'
    or (input_item ->> 'priority') not in ('low', 'medium', 'high', 'urgent')
    or not (input_item ? 'dueInDays') then
    return false;
  end if;

  if jsonb_typeof(input_item -> 'dueInDays') <> 'null' then
    if jsonb_typeof(input_item -> 'dueInDays') <> 'number' then
      return false;
    end if;

    due_days := (input_item ->> 'dueInDays')::numeric;
    if due_days <> trunc(due_days) or due_days < 0 or due_days > 365 then
      return false;
    end if;
  end if;

  if require_subtasks and (
    jsonb_typeof(input_item -> 'subtasks') <> 'array'
    or jsonb_array_length(input_item -> 'subtasks') > 12
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke execute on function public.is_valid_ai_plan_item(jsonb, boolean)
from public, anon, authenticated, service_role;

create or replace function public.approve_ai_task_plan(input_draft_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  draft public.ai_task_plan_drafts%rowtype;
  current_parent_project_id uuid;
  current_parent_status text;
  generated_task jsonb;
  generated_subtask jsonb;
  created_task_id uuid;
  created_count integer := 0;
  due_days integer;
begin
  if actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
  into draft
  from public.ai_task_plan_drafts
  where id = input_draft_id
    and user_id = actor_id
  for update;

  if not found then
    raise exception 'AI plan draft not found.';
  end if;

  if draft.status <> 'pending' then
    raise exception 'AI plan draft is no longer pending.';
  end if;

  if draft.expires_at <= now() then
    update public.ai_task_plan_drafts
    set status = 'expired'
    where id = draft.id;
    return -1;
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = draft.workspace_id
      and user_id = actor_id
      and role in ('owner', 'admin', 'member')
  ) then
    raise exception 'AI plan approval denied.' using errcode = '42501';
  end if;

  if draft.project_id is not null and not exists (
    select 1
    from public.projects
    where id = draft.project_id
      and workspace_id = draft.workspace_id
      and status <> 'archived'
  ) then
    raise exception 'AI plan project is no longer available.';
  end if;

  if draft.parent_task_id is not null then
    select project_id, status
    into current_parent_project_id, current_parent_status
    from public.tasks
    where id = draft.parent_task_id
      and workspace_id = draft.workspace_id;

    if not found
      or current_parent_status in ('done', 'cancelled')
      or (
        draft.project_id is not null
        and current_parent_project_id is not null
        and draft.project_id <> current_parent_project_id
      ) then
      raise exception 'AI plan parent task is no longer available.';
    end if;
  end if;

  if jsonb_typeof(draft.plan -> 'title') <> 'string'
    or char_length(btrim(draft.plan ->> 'title')) not between 2 and 160
    or jsonb_typeof(draft.plan -> 'tasks') <> 'array'
    or jsonb_array_length(draft.plan -> 'tasks') not between 1 and 8 then
    raise exception 'AI plan structure is invalid.';
  end if;

  for generated_task in
    select value from jsonb_array_elements(draft.plan -> 'tasks')
  loop
    if not public.is_valid_ai_plan_item(generated_task, true) then
      raise exception 'AI task structure is invalid.';
    end if;

    due_days := case
      when jsonb_typeof(generated_task -> 'dueInDays') = 'number'
        then (generated_task ->> 'dueInDays')::integer
      else null
    end;

    insert into public.tasks (
      workspace_id,
      project_id,
      parent_task_id,
      title,
      description,
      status,
      priority,
      due_at,
      created_by
    ) values (
      draft.workspace_id,
      draft.project_id,
      draft.parent_task_id,
      btrim(generated_task ->> 'title'),
      nullif(btrim(generated_task ->> 'description'), ''),
      'todo',
      generated_task ->> 'priority',
      case when due_days is null then null else now() + make_interval(days => due_days) end,
      actor_id
    )
    returning id into created_task_id;

    created_count := created_count + 1;

    for generated_subtask in
      select value from jsonb_array_elements(generated_task -> 'subtasks')
    loop
      if not public.is_valid_ai_plan_item(generated_subtask, false) then
        raise exception 'AI subtask structure is invalid.';
      end if;

      due_days := case
        when jsonb_typeof(generated_subtask -> 'dueInDays') = 'number'
          then (generated_subtask ->> 'dueInDays')::integer
        else null
      end;

      insert into public.tasks (
        workspace_id,
        project_id,
        parent_task_id,
        title,
        description,
        status,
        priority,
        due_at,
        created_by
      ) values (
        draft.workspace_id,
        draft.project_id,
        created_task_id,
        btrim(generated_subtask ->> 'title'),
        nullif(btrim(generated_subtask ->> 'description'), ''),
        'todo',
        generated_subtask ->> 'priority',
        case when due_days is null then null else now() + make_interval(days => due_days) end,
        actor_id
      );

      created_count := created_count + 1;
    end loop;
  end loop;

  update public.ai_task_plan_drafts
  set status = 'approved', approved_at = now()
  where id = draft.id;

  insert into public.activity_logs (
    workspace_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    draft.workspace_id,
    actor_id,
    'ai.plan_accepted',
    'ai_task_plan',
    draft.id,
    jsonb_build_object('created_task_count', created_count, 'mode', draft.mode)
  );

  return created_count;
end;
$$;

revoke execute on function public.approve_ai_task_plan(uuid) from public, anon;
grant execute on function public.approve_ai_task_plan(uuid) to authenticated;
