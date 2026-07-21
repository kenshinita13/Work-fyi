import type { WorkspaceRole } from "@/types/database";

export function canManageProjects(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}
