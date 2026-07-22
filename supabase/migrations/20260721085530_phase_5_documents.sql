create or replace function private.is_valid_document_summary(input_summary jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(input_summary) <> 'object'
    or jsonb_typeof(input_summary -> 'summary') <> 'string'
    or char_length(btrim(input_summary ->> 'summary')) not between 20 and 6000
    or jsonb_typeof(input_summary -> 'highlights') <> 'array'
    or jsonb_array_length(input_summary -> 'highlights') > 8 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(input_summary) as summary_key
    where summary_key not in ('summary', 'highlights')
  ) or exists (
    select 1
    from jsonb_array_elements(input_summary -> 'highlights') as highlight
    where jsonb_typeof(highlight) <> 'string'
      or char_length(btrim(highlight #>> '{}')) not between 1 and 500
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.is_valid_document_summary(jsonb)
  from public, anon, authenticated, service_role;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  uploaded_by uuid not null references auth.users(id),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  )),
  file_size bigint not null check (file_size between 1 and 10485760),
  summary_draft jsonb check (
    summary_draft is null
    or private.is_valid_document_summary(summary_draft)
  ),
  summary_model text check (
    summary_model is null or char_length(summary_model) between 1 and 200
  ),
  summary_generated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_storage_path_check check (
    storage_path like workspace_id::text || '/' || id::text || '/%'
  ),
  constraint documents_summary_state_check check (
    (summary_draft is null and summary_model is null and summary_generated_at is null)
    or
    (summary_draft is not null and summary_model is not null and summary_generated_at is not null)
  ),
  constraint documents_deleted_by_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  )
);

create index documents_workspace_created_idx
  on public.documents (workspace_id, created_at desc)
  where deleted_at is null;
create index documents_project_created_idx
  on public.documents (project_id, created_at desc)
  where project_id is not null and deleted_at is null;
create index documents_task_created_idx
  on public.documents (task_id, created_at desc)
  where task_id is not null and deleted_at is null;
create index documents_uploaded_by_idx
  on public.documents (uploaded_by, created_at desc);

create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace function private.validate_document_relationships()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_task_project_id uuid;
begin
  if new.storage_path not like new.workspace_id::text || '/' || new.id::text || '/%' then
    raise exception 'Document storage path does not match its workspace and identifier.';
  end if;

  if new.project_id is not null and not exists (
    select 1
    from public.projects
    where id = new.project_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Document project must belong to its workspace.';
  end if;

  if new.task_id is not null then
    select project_id
    into linked_task_project_id
    from public.tasks
    where id = new.task_id
      and workspace_id = new.workspace_id;

    if not found then
      raise exception 'Document task must belong to its workspace.';
    end if;

    if new.project_id is not null
      and linked_task_project_id is distinct from new.project_id then
      raise exception 'Document project must match its linked task project.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_relationships()
  from public, anon, authenticated, service_role;

create trigger enforce_document_relationships
before insert or update of workspace_id, project_id, task_id, storage_path
on public.documents
for each row execute function private.validate_document_relationships();

alter table public.documents enable row level security;

create policy "Documents are selectable by workspace members"
on public.documents for select
to authenticated
using (
  deleted_at is null
  and private.is_workspace_member(workspace_id)
);

revoke all on public.documents from public, anon, authenticated;
grant select on public.documents to authenticated;
grant all on public.documents to service_role;

create or replace function private.storage_workspace_id(input_name text)
returns uuid
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
  return split_part(input_name, '/', 1)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.storage_workspace_id(text) from public;
grant execute on function private.storage_workspace_id(text)
  to authenticated, service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'workspace-documents',
  'workspace-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Workspace members can read document objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-documents'
  and exists (
    select 1
    from public.documents
    where storage_path = name
      and workspace_id = private.storage_workspace_id(name)
      and deleted_at is null
      and private.is_workspace_member(workspace_id)
  )
);

create policy "Workspace contributors can upload registered documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-documents'
  and exists (
    select 1
    from public.documents
    where storage_path = name
      and workspace_id = private.storage_workspace_id(name)
      and uploaded_by = (select auth.uid())
      and deleted_at is null
      and private.has_workspace_role(
        workspace_id,
        array['owner', 'admin', 'member']
      )
  )
);

create policy "Workspace contributors can delete document objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-documents'
  and exists (
    select 1
    from public.documents
    where storage_path = name
      and workspace_id = private.storage_workspace_id(name)
      and private.has_workspace_role(
        workspace_id,
        array['owner', 'admin', 'member']
      )
  )
);

create or replace function public.reserve_document_summary_usage(
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

  perform pg_advisory_xact_lock(
    hashtextextended(input_workspace_id::text, 90422)
  );

  if (
    select count(*)
    from public.ai_usage
    where user_id = input_user_id
      and feature = 'document_summary'
      and created_at >= now() - interval '1 minute'
  ) >= 3 then
    raise exception 'AI_RATE_LIMIT';
  end if;

  if (
    select count(*)
    from public.ai_usage
    where workspace_id = input_workspace_id
      and feature = 'document_summary'
      and created_at >= date_trunc('day', now())
  ) >= 50 then
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
    'document_summary',
    left(input_model, 200),
    'started'
  )
  returning id into usage_id;

  return usage_id;
end;
$$;

revoke execute on function public.reserve_document_summary_usage(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_document_summary_usage(uuid, uuid, text)
  to service_role;
