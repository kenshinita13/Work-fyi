"use client";

import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DocumentSharePermission,
  DocumentVisibility,
  WorkspaceRole,
} from "@/types/database";

type ShareMember = {
  userId: string;
  name: string;
  role: WorkspaceRole;
};

type ExistingShare = {
  userId: string;
  permission: DocumentSharePermission;
};

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "Document sharing could not be updated.";
  } catch {
    return "Document sharing could not be updated.";
  }
}

export function DocumentShareDialog({
  documentId,
  initialVisibility,
  members,
  initialShares,
}: {
  documentId: string;
  initialVisibility: DocumentVisibility;
  members: ShareMember[];
  initialShares: ExistingShare[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] =
    useState<DocumentVisibility>(initialVisibility);
  const [shares, setShares] = useState<Record<string, DocumentSharePermission>>(
    () =>
      Object.fromEntries(
        initialShares.map((share) => [share.userId, share.permission]),
      ),
  );
  const [saving, setSaving] = useState(false);

  function toggleMember(member: ShareMember, checked: boolean) {
    setShares((current) => {
      const next = { ...current };
      if (checked) next[member.userId] = "viewer";
      else delete next[member.userId];
      return next;
    });
  }

  async function saveSharing() {
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          shares: Object.entries(shares).map(([userId, permission]) => ({
            userId,
            permission,
          })),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      toast.success("Document sharing updated.");
      setOpen(false);
      router.refresh();
    } catch (shareError) {
      toast.error(
        shareError instanceof Error
          ? shareError.message
          : "Document sharing could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="size-4" aria-hidden="true" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Control whether this file is available across the workspace or only
            to selected workmates.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="document-access">Access</Label>
            <Select
              value={visibility}
              onValueChange={(value) =>
                setVisibility(value as DocumentVisibility)
              }
              disabled={saving}
            >
              <SelectTrigger id="document-access" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">Entire workspace</SelectItem>
                <SelectItem value="restricted">Selected workmates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visibility === "restricted" && (
            <div className="grid gap-2">
              <Label>Workmates</Label>
              <div className="divide-y rounded-md border">
                {members.map((member) => {
                  const permission = shares[member.userId];
                  return (
                    <div
                      key={member.userId}
                      className="flex min-h-14 items-center gap-3 px-3 py-2"
                    >
                      <input
                        id={`share-${member.userId}`}
                        type="checkbox"
                        checked={Boolean(permission)}
                        onChange={(event) =>
                          toggleMember(member, event.target.checked)
                        }
                        disabled={saving}
                        className="size-4 accent-primary"
                      />
                      <label
                        htmlFor={`share-${member.userId}`}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="block truncate text-sm font-medium">
                          {member.name}
                        </span>
                        <Badge variant="outline" className="mt-1 font-normal">
                          {member.role}
                        </Badge>
                      </label>
                      {permission && (
                        <Select
                          value={permission}
                          onValueChange={(value) =>
                            setShares((current) => ({
                              ...current,
                              [member.userId]: value as DocumentSharePermission,
                            }))
                          }
                          disabled={saving}
                        >
                          <SelectTrigger
                            className="w-28"
                            aria-label={`${member.name} permission`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            {member.role !== "viewer" && (
                              <SelectItem value="editor">Editor</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
                {members.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No other workspace members are available.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="ml-auto">
            <Button type="button" onClick={saveSharing} disabled={saving}>
              <Share2 className="size-4" aria-hidden="true" />
              {saving ? "Saving..." : "Save sharing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
