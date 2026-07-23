create table public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_account_id text not null,
  account_email text not null,
  display_name text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'error', 'revoked')),
  last_error_code text,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider),
  unique (workspace_id, provider, provider_account_id)
);

create index user_integrations_user_idx
  on public.user_integrations (user_id, workspace_id);
create index user_integrations_status_idx
  on public.user_integrations (workspace_id, status);

create trigger set_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();

alter table public.user_integrations enable row level security;

create policy "Integrations are selectable by their owner"
on public.user_integrations
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Integrations are insertable by their owner"
on public.user_integrations
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Integrations are updatable by their owner"
on public.user_integrations
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Integrations are deletable by their owner"
on public.user_integrations
for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

-- Tokens are only handled by authenticated server routes through service_role.
revoke all on public.user_integrations from anon, authenticated;
grant all on public.user_integrations to service_role;

create table public.google_document_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_file_id text not null,
  google_mime_type text not null check (
    google_mime_type in (
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.google-apps.presentation'
    )
  ),
  google_web_url text not null,
  google_modified_time timestamptz,
  last_synced_revision integer not null default 0 check (last_synced_revision >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, document_id, user_id),
  unique (workspace_id, user_id, google_file_id)
);

create index google_document_links_user_idx
  on public.google_document_links (user_id, workspace_id);

create trigger set_google_document_links_updated_at
before update on public.google_document_links
for each row execute function public.set_updated_at();

alter table public.google_document_links enable row level security;

create policy "Google document links are selectable by their owner"
on public.google_document_links
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Google document links are insertable by their owner"
on public.google_document_links
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Google document links are updatable by their owner"
on public.google_document_links
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy "Google document links are deletable by their owner"
on public.google_document_links
for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

revoke all on public.google_document_links from anon, authenticated;
grant all on public.google_document_links to service_role;

create table public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  provider text,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_audit_logs_workspace_created_idx
  on public.security_audit_logs (workspace_id, created_at desc);
create index security_audit_logs_actor_idx
  on public.security_audit_logs (actor_id, created_at desc);

alter table public.security_audit_logs enable row level security;

create policy "Security audit logs are selectable by workspace administrators"
on public.security_audit_logs
for select to authenticated
using (
  (select private.has_workspace_role(workspace_id, array['owner', 'admin']))
);

create policy "Security audit logs are not directly insertable"
on public.security_audit_logs
for insert to authenticated
with check (false);

create policy "Security audit logs are not updatable"
on public.security_audit_logs
for update to authenticated
using (false)
with check (false);

create policy "Security audit logs are not deletable"
on public.security_audit_logs
for delete to authenticated
using (false);

grant select on public.security_audit_logs to authenticated;
grant all on public.security_audit_logs to service_role;

create or replace function public.reserve_google_email_summary_usage(
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
    select 1 from public.workspace_members
    where workspace_id = input_workspace_id
      and user_id = input_user_id
      and role in ('owner', 'admin', 'member')
  ) then
    raise exception 'AI workspace access denied.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(input_workspace_id::text || input_user_id::text, 260722)
  );

  if (
    select count(*) from public.ai_usage
    where user_id = input_user_id
      and feature = 'google_email_summary'
      and created_at >= now() - interval '1 minute'
  ) >= 3 then
    raise exception 'AI_RATE_LIMIT';
  end if;

  if (
    select count(*) from public.ai_usage
    where workspace_id = input_workspace_id
      and feature = 'google_email_summary'
      and created_at >= date_trunc('day', now())
  ) >= 50 then
    raise exception 'AI_QUOTA_EXCEEDED';
  end if;

  insert into public.ai_usage (
    workspace_id, user_id, feature, model, status
  ) values (
    input_workspace_id,
    input_user_id,
    'google_email_summary',
    left(input_model, 200),
    'started'
  ) returning id into usage_id;

  return usage_id;
end;
$$;

revoke execute on function public.reserve_google_email_summary_usage(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_google_email_summary_usage(uuid, uuid, text)
  to service_role;
