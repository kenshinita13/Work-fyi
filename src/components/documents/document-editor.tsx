"use client";

import { Eye, FileText, Pencil, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProjectOption = { id: string; name: string };
type TaskOption = { id: string; title: string; projectName: string | null };

type DocumentEditorProps = {
  documentId?: string;
  initialFileName?: string;
  initialContent?: string;
  initialRevision?: number;
  format?: "txt" | "md";
  canEdit?: boolean;
  projects?: ProjectOption[];
  tasks?: TaskOption[];
};

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function DocumentEditor({
  documentId,
  initialFileName = "Untitled",
  initialContent = "",
  initialRevision = 1,
  format: initialFormat = "md",
  canEdit = true,
  projects = [],
  tasks = [],
}: DocumentEditorProps) {
  const router = useRouter();
  const creating = !documentId;
  const [fileName, setFileName] = useState(initialFileName);
  const [content, setContent] = useState(initialContent);
  const [format, setFormat] = useState<"txt" | "md">(initialFormat);
  const [projectId, setProjectId] = useState("none");
  const [taskId, setTaskId] = useState("none");
  const [revision, setRevision] = useState(initialRevision);
  const [view, setView] = useState<"edit" | "preview">(
    canEdit ? "edit" : "preview",
  );
  const [saving, setSaving] = useState(false);

  async function saveDocument() {
    if (!canEdit || saving) return;
    setSaving(true);

    try {
      const response = await fetch(
        creating ? "/api/documents/native" : `/api/documents/${documentId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            creating
              ? { fileName, format, content, projectId, taskId }
              : { fileName, content, expectedRevision: revision },
          ),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseError(response, "The document could not be saved."),
        );
      }

      const payload = (await response.json()) as {
        id?: string;
        revision: number;
        fileName?: string;
      };
      if (creating && payload.id) {
        toast.success("Document created.");
        router.push(`/documents/${payload.id}`);
        return;
      }

      setRevision(payload.revision);
      if (payload.fileName) setFileName(payload.fileName);
      toast.success("Document saved.");
      router.refresh();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "The document could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-[620px] grid-rows-[auto_1fr] border-t bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-52 flex-1">
          <Label htmlFor="document-name" className="sr-only">
            Document name
          </Label>
          <Input
            id="document-name"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            disabled={!canEdit || saving}
            className="max-w-xl font-medium"
          />
        </div>

        {creating && (
          <>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as "txt" | "md")}
              disabled={saving}
            >
              <SelectTrigger className="w-32" aria-label="Document format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="md">Markdown</SelectItem>
                <SelectItem value="txt">Plain text</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={saving}
            >
              <SelectTrigger className="w-44" aria-label="Project">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={taskId} onValueChange={setTaskId} disabled={saving}>
              <SelectTrigger className="w-44" aria-label="Task">
                <SelectValue placeholder="No task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.projectName
                      ? `${task.title} - ${task.projectName}`
                      : task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="flex h-9 items-center rounded-md border p-0.5">
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant={view === "edit" ? "secondary" : "ghost"}
              onClick={() => setView("edit")}
              title="Edit document"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={view === "preview" ? "secondary" : "ghost"}
            onClick={() => setView("preview")}
            title="Preview document"
          >
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Button>
        </div>

        {canEdit && (
          <Button type="button" onClick={saveDocument} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Saving..." : creating ? "Create" : "Save"}
          </Button>
        )}
      </div>

      {view === "edit" ? (
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={!canEdit || saving}
          spellCheck
          className="h-full min-h-[560px] resize-none rounded-none border-0 px-5 py-5 font-mono text-sm leading-6 shadow-none focus-visible:ring-0 sm:px-7"
          aria-label="Document content"
        />
      ) : (
        <div className="min-h-[560px] overflow-y-auto px-5 py-7 sm:px-8">
          {format === "md" ? (
            <MessageResponse>{content || " "}</MessageResponse>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6">
              {content}
            </pre>
          )}
          {!content && (
            <div className="flex min-h-72 items-center justify-center text-muted-foreground">
              <FileText className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
