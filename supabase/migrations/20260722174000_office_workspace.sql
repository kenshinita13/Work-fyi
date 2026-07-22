alter table public.documents
  drop constraint documents_mime_type_check;

alter table public.documents
  add constraint documents_mime_type_check check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown'
  )),
  add column editor_kind text check (
    editor_kind in ('text', 'rich_document', 'spreadsheet', 'presentation')
  ),
  add column editor_state jsonb,
  add constraint documents_editor_state_size_check check (
    editor_state is null
    or (
      jsonb_typeof(editor_state) = 'object'
      and octet_length(editor_state::text) <= 2097152
    )
  );

update public.documents
set editor_kind = 'text'
where editable_content is not null;

alter table public.documents
  add constraint documents_editor_contract_check check (
    (
      editor_kind is null
      and editor_state is null
      and editable_content is null
    )
    or (
      editor_kind = 'text'
      and mime_type in ('text/plain', 'text/markdown')
      and editable_content is not null
      and editor_state is null
    )
    or (
      editor_kind = 'rich_document'
      and mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      and editable_content is null
      and editor_state is not null
    )
    or (
      editor_kind = 'spreadsheet'
      and mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      and editable_content is null
      and editor_state is not null
    )
    or (
      editor_kind = 'presentation'
      and mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      and editable_content is null
      and editor_state is not null
    )
  );

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown'
]::text[]
where id = 'workspace-documents';
