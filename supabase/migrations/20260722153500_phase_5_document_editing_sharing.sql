alter table public.documents
  drop constraint documents_file_size_check;

alter table public.documents
  add constraint documents_file_size_check
    check (file_size between 0 and 10485760),
  add column visibility text not null default 'workspace'
    check (visibility in ('workspace', 'restricted')),
  add column editable_content text,
  add column content_revision integer not null default 1
    check (content_revision > 0),
  add column last_edited_by uuid references auth.users(id),
  add column last_edited_at timestamptz,
  add constraint documents_editable_content_check check (
    editable_content is null
    or (
      mime_type in ('text/plain', 'text/markdown')
      and octet_length(editable_content) <= 1048576
    )
  ),
  add constraint documents_last_edit_check check (
    (last_edited_by is null and last_edited_at is null)
    or (last_edited_by is not null and last_edited_at is not null)
  );

create table public.document_shares (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('viewer', 'editor')),
  shared_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index document_shares_user_id_idx
  on public.document_shares (user_id, document_id);

create trigger set_document_shares_updated_at
before update on public.document_shares
for each row execute function public.set_updated_at();

create or replace function private.can_access_document(
  target_document_id uuid,
  target_workspace_id uuid,
  target_uploaded_by uuid,
  target_visibility text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = (select auth.uid())
      and (
        target_visibility = 'workspace'
        or target_uploaded_by = (select auth.uid())
        or membership.role in ('owner', 'admin')
        or exists (
          select 1
          from public.document_shares document_share
          where document_share.document_id = target_document_id
            and document_share.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_manage_document_sharing(
  target_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.documents document
    join public.workspace_members membership
      on membership.workspace_id = document.workspace_id
     and membership.user_id = (select auth.uid())
    where document.id = target_document_id
      and document.deleted_at is null
      and (
        membership.role in ('owner', 'admin')
        or (
          document.uploaded_by = (select auth.uid())
          and membership.role = 'member'
        )
      )
  );
$$;

revoke all on function private.can_access_document(uuid, uuid, uuid, text)
  from public, anon;
revoke all on function private.can_manage_document_sharing(uuid)
  from public, anon;
grant execute on function private.can_access_document(uuid, uuid, uuid, text)
  to authenticated, service_role;
grant execute on function private.can_manage_document_sharing(uuid)
  to authenticated, service_role;

drop policy "Documents are selectable by workspace members"
  on public.documents;

create policy "Authorized workspace members can select documents"
on public.documents for select
to authenticated
using (
  deleted_at is null
  and private.can_access_document(
    id,
    workspace_id,
    uploaded_by,
    visibility
  )
);

alter table public.document_shares enable row level security;

create policy "Authorized members can select document shares"
on public.document_shares for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_document_sharing(document_id)
);

revoke all on public.document_shares from public, anon, authenticated;
grant select on public.document_shares to authenticated;
grant all on public.document_shares to service_role;

create or replace function public.set_document_sharing(
  input_document_id uuid,
  input_workspace_id uuid,
  input_actor_id uuid,
  input_visibility text,
  input_shares jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  document_uploader uuid;
  share_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  if input_visibility not in ('workspace', 'restricted') then
    raise exception 'Invalid document visibility.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(input_shares, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(input_shares, '[]'::jsonb)) > 100 then
    raise exception 'Invalid document shares.' using errcode = '22023';
  end if;

  select membership.role
  into actor_role
  from public.workspace_members membership
  where membership.workspace_id = input_workspace_id
    and membership.user_id = input_actor_id;

  select document.uploaded_by
  into document_uploader
  from public.documents document
  where document.id = input_document_id
    and document.workspace_id = input_workspace_id
    and document.deleted_at is null
  for update;

  if actor_role is null or document_uploader is null then
    raise exception 'Document not found.' using errcode = 'P0002';
  end if;

  if actor_role not in ('owner', 'admin')
    and not (actor_role = 'member' and document_uploader = input_actor_id) then
    raise exception 'Insufficient document sharing permission.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(input_shares, '[]'::jsonb))
      as requested(user_id uuid, permission text)
    left join public.workspace_members target
      on target.workspace_id = input_workspace_id
     and target.user_id = requested.user_id
    where requested.user_id = input_actor_id
      or requested.permission not in ('viewer', 'editor')
      or target.user_id is null
      or (requested.permission = 'editor' and target.role = 'viewer')
  ) then
    raise exception 'A document share target is invalid.' using errcode = '22023';
  end if;

  delete from public.document_shares
  where document_id = input_document_id;

  if input_visibility = 'restricted' then
    insert into public.document_shares (
      document_id,
      user_id,
      permission,
      shared_by
    )
    select
      input_document_id,
      requested.user_id,
      requested.permission,
      input_actor_id
    from jsonb_to_recordset(coalesce(input_shares, '[]'::jsonb))
      as requested(user_id uuid, permission text);
  end if;

  update public.documents
  set visibility = input_visibility
  where id = input_document_id;

  select count(*)::integer
  into share_count
  from public.document_shares
  where document_id = input_document_id;

  return share_count;
end;
$$;

revoke all on function public.set_document_sharing(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.set_document_sharing(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
) to service_role;
