-- Document writes run through the service-role API and must be able to evaluate
-- the private summary validator used by the table check constraint.
grant execute on function private.is_valid_document_summary(jsonb)
  to service_role;
