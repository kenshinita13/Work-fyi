import type { WorkspaceRole } from "@/types/database";

export function canChangeWorkspaceRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  nextRole: WorkspaceRole,
) {
  if (targetRole === "owner" || nextRole === "owner") return false;
  if (actorRole === "owner") return true;
  return (
    actorRole === "admin" &&
    (targetRole === "member" || targetRole === "viewer") &&
    (nextRole === "member" || nextRole === "viewer")
  );
}
