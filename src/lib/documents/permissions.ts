import type {
  DocumentSharePermission,
  DocumentVisibility,
  WorkspaceRole,
} from "@/types/database";

type DocumentPermissionTarget = {
  uploadedBy: string;
  visibility: DocumentVisibility;
};

export function canEditDocument(
  role: WorkspaceRole,
  userId: string,
  document: DocumentPermissionTarget,
  sharePermission: DocumentSharePermission | null,
) {
  if (role === "viewer") return false;
  if (role === "owner" || role === "admin") return true;
  if (document.uploadedBy === userId) return true;
  if (document.visibility === "workspace") return true;
  return sharePermission === "editor";
}

export function canManageDocumentSharing(
  role: WorkspaceRole,
  userId: string,
  uploadedBy: string,
) {
  if (role === "owner" || role === "admin") return true;
  return role === "member" && uploadedBy === userId;
}
