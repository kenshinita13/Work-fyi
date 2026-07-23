"use client";

import { ExternalLink, Link2, RefreshCw, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function GooglePublishButton({
  documentId,
  revision,
  target,
  initialUrl,
  connected,
}: {
  documentId: string;
  revision: number;
  target: "docs" | "sheets" | "slides";
  initialUrl?: string | null;
  connected: boolean;
}) {
  const [url, setUrl] = useState(initialUrl ?? null);
  const [publishing, setPublishing] = useState(false);
  const label =
    target === "docs"
      ? "Google Docs"
      : target === "sheets"
        ? "Google Sheets"
        : "Google Slides";

  if (!connected) {
    return (
      <Button
        variant="outline"
        asChild
        title={`Connect Google to use ${label}`}
      >
        <a href="/integrations">
          <Link2 className="size-4" aria-hidden="true" />
          Connect Google
        </a>
      </Button>
    );
  }

  async function publish() {
    setPublishing(true);
    try {
      const response = await fetch("/api/integrations/google/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          target,
          expectedRevision: revision,
          confirmed: true,
        }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
        created?: boolean;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.error || `Could not publish to ${label}.`);
      setUrl(payload.url);
      toast.success(
        payload.created
          ? `Published to ${label}.`
          : `${label} copy synchronized.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Google publish failed.",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            disabled={publishing}
            title={
              url
                ? `Sync saved version to ${label}`
                : `Publish saved version to ${label}`
            }
          >
            {url ? (
              <RefreshCw className="size-4" aria-hidden="true" />
            ) : (
              <UploadCloud className="size-4" aria-hidden="true" />
            )}
            {url ? "Sync" : "Publish"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {url
                ? `Replace the linked ${label} content?`
                : `Publish to ${label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {url
                ? `This replaces the linked file with revision ${revision} currently saved in Work.fyi. Review any Google-side collaborator edits first.`
                : `This creates a new ${label} file from revision ${revision} currently saved in Work.fyi.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={publish}>
              Confirm {url ? "sync" : "publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {url && (
        <Button variant="ghost" size="icon" asChild title={`Open in ${label}`}>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}
