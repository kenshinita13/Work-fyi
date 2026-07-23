"use client";

import {
  ExternalLink,
  File,
  FileInput,
  FolderOpen,
  FolderSearch,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

type GooglePickerCallback = { action?: string };

type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: unknown): PickerBuilder;
  setAppId(value: string): PickerBuilder;
  setCallback(callback: (data: GooglePickerCallback) => void): PickerBuilder;
  setDeveloperKey(value: string): PickerBuilder;
  setOAuthToken(value: string): PickerBuilder;
  setOrigin(value: string): PickerBuilder;
  build(): { setVisible(value: boolean): void };
};

declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void };
    google?: {
      picker: {
        Action: { PICKED: string };
        DocsView: new () => unknown;
        Feature: { MULTISELECT_ENABLED: unknown };
        PickerBuilder: new () => PickerBuilder;
      };
    };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function loadPickerScript() {
  if (window.google?.picker && window.gapi) return Promise.resolve();
  if (!pickerScriptPromise) {
    pickerScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-work-fyi-google-picker="true"]',
      );
      const script = existing ?? document.createElement("script");
      script.dataset.workFyiGooglePicker = "true";
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.onload = () => window.gapi?.load("picker", () => resolve());
      script.onerror = () => reject(new Error("Google Picker could not load."));
      if (!existing) document.head.appendChild(script);
    });
  }
  return pickerScriptPromise;
}

function fileKind(mimeType: string) {
  if (mimeType.endsWith(".document")) return "Google Doc";
  if (mimeType.endsWith(".spreadsheet")) return "Google Sheet";
  if (mimeType.endsWith(".presentation")) return "Google Slides";
  if (mimeType.endsWith(".folder")) return "Folder";
  return "Drive file";
}

export function GoogleDriveBrowser({
  pickerApiKey,
  projectNumber,
}: {
  pickerApiKey?: string;
  projectNumber?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [importCandidate, setImportCandidate] = useState<DriveFile | null>(
    null,
  );
  const [importing, setImporting] = useState(false);

  async function loadFiles(search = "") {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/integrations/google/drive?q=${encodeURIComponent(search)}`,
      );
      const payload = (await response.json()) as {
        files?: DriveFile[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Drive files could not be loaded.");
      setFiles(payload.files ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Drive is unavailable.",
      );
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/integrations/google/drive?q=")
      .then(async (response) => {
        const payload = (await response.json()) as {
          files?: DriveFile[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error || "Drive files could not be loaded.");
        if (active) setFiles(payload.files ?? []);
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(
            error instanceof Error ? error.message : "Drive is unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    void loadFiles(query);
  }

  async function openPicker() {
    try {
      const tokenResponse = await fetch(
        "/api/integrations/google/picker-token",
      );
      const token = (await tokenResponse.json()) as {
        accessToken?: string;
        error?: string;
      };
      if (!tokenResponse.ok || !token.accessToken) {
        throw new Error(token.error || "Google Picker is unavailable.");
      }
      await loadPickerScript();
      const picker = window.google?.picker;
      if (!picker || !pickerApiKey || !projectNumber) {
        throw new Error("Google Picker has not been configured.");
      }
      new picker.PickerBuilder()
        .addView(new picker.DocsView())
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token.accessToken)
        .setDeveloperKey(pickerApiKey)
        .setAppId(projectNumber)
        .setOrigin(window.location.origin)
        .setCallback((data) => {
          if (data.action === picker.Action.PICKED) void loadFiles(query);
        })
        .build()
        .setVisible(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Google Picker is unavailable.",
      );
    }
  }

  async function importFile() {
    if (!importCandidate) return;
    setImporting(true);
    try {
      const response = await fetch("/api/integrations/google/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: importCandidate.id,
          confirmed: true,
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(
          payload.error || "The Google file could not be imported.",
        );
      }
      toast.success("Google file imported as a restricted Work.fyi document.");
      router.push(`/documents/${payload.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Google import failed.",
      );
    } finally {
      setImporting(false);
      setImportCandidate(null);
    }
  }

  return (
    <section className="border-t">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-52 flex-1">
          <h2 className="font-semibold">Google Drive</h2>
          <p className="text-sm text-muted-foreground">
            Files created by or explicitly shared with Work.fyi.
          </p>
        </div>
        {pickerApiKey && projectNumber && (
          <Button type="button" variant="outline" onClick={openPicker}>
            <FolderOpen className="size-4" aria-hidden="true" />
            Choose from Drive
          </Button>
        )}
        <form
          className="flex w-full max-w-md gap-2 sm:w-auto"
          onSubmit={search}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Drive"
            aria-label="Search Google Drive"
          />
          <Button
            type="submit"
            size="icon"
            variant="outline"
            disabled={loading}
            title="Search Drive"
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>
        </form>
      </div>
      <div className="border-t">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Loading Drive files...
          </p>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <FolderSearch
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">No accessible files found</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Publish a Work.fyi document to Google Docs or Sheets and it will
              appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 sm:px-6"
              >
                <File
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileKind(file.mimeType)}
                    {file.modifiedTime
                      ? ` · Updated ${new Date(file.modifiedTime).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {[
                  "application/vnd.google-apps.document",
                  "application/vnd.google-apps.spreadsheet",
                  "application/vnd.google-apps.presentation",
                ].includes(file.mimeType) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportCandidate(file)}
                    title="Import a restricted copy into Work.fyi"
                  >
                    <FileInput className="size-4" aria-hidden="true" />
                    Import
                  </Button>
                )}
                {file.webViewLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    title="Open in Google Drive"
                  >
                    <a href={file.webViewLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <AlertDialog
        open={Boolean(importCandidate)}
        onOpenChange={(open) => {
          if (!open && !importing) setImportCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import into Work.fyi?</AlertDialogTitle>
            <AlertDialogDescription>
              {importCandidate?.name} will be converted into an editable,
              restricted workspace document visible only to you until you share
              it. Future synchronization back to Google remains an explicit
              action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={importFile} disabled={importing}>
              {importing ? "Importing..." : "Confirm import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
