"use client";

import { Download, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
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
import type { DocumentSummary } from "@/types/database";

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function DocumentActions({
  documentId,
  fileName,
  summary,
  canSummarize,
  canDelete,
}: {
  documentId: string;
  fileName: string;
  summary: DocumentSummary | null;
  canSummarize: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [summarizing, setSummarizing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function summarize() {
    setSummarizing(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/summary`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The summary could not be generated."),
        );
      }
      toast.success("Summary draft generated.");
      router.refresh();
    } catch (summaryError) {
      toast.error(
        summaryError instanceof Error
          ? summaryError.message
          : "The summary could not be generated.",
      );
    } finally {
      setSummarizing(false);
    }
  }

  async function removeDocument() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The document could not be deleted."),
        );
      }
      toast.success("Document deleted.");
      router.refresh();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "The document could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" asChild title="Download document">
        <a href={`/api/documents/${documentId}/download`}>
          <Download className="size-4" aria-hidden="true" />
          <span className="sr-only">Download {fileName}</span>
        </a>
      </Button>

      {summary && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              View draft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle>Summary</DialogTitle>
                <Badge variant="outline">Draft</Badge>
              </div>
              <DialogDescription>{fileName}</DialogDescription>
            </DialogHeader>
            <MessageResponse>{summary.summary}</MessageResponse>
            {summary.highlights.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium">Highlights</h3>
                <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
                  {summary.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <span aria-hidden="true">&bull;</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {(canSummarize || canDelete) && (
        <>
          {canSummarize && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={
                summary ? "Regenerate summary draft" : "Generate summary draft"
              }
              disabled={summarizing}
              onClick={summarize}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              <span className="sr-only">
                {summary
                  ? "Regenerate summary draft"
                  : "Generate summary draft"}
              </span>
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Delete document"
                  disabled={deleting}
                >
                  <Trash2
                    className="size-4 text-destructive"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Delete {fileName}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {fileName} will be removed from this workspace. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={removeDocument}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </div>
  );
}
