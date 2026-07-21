alter function public.approve_ai_task_plan(uuid) set schema private;

revoke all on function private.approve_ai_task_plan(uuid)
  from public, anon;
grant execute on function private.approve_ai_task_plan(uuid)
  to authenticated, service_role;

create function public.approve_ai_task_plan(input_draft_id uuid)
returns integer
language sql
security invoker
set search_path = pg_catalog
as $$
  select private.approve_ai_task_plan(input_draft_id);
$$;

revoke all on function public.approve_ai_task_plan(uuid)
  from public, anon;
grant execute on function public.approve_ai_task_plan(uuid)
  to authenticated, service_role;
