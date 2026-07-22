"use client";

import { FileText, Loader2, Presentation, Sheet, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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

type ProjectOption = { id: string; name: string };
type TaskOption = { id: string; title: string; projectName: string | null };
type NativeFormat = "docx" | "xlsx" | "pptx" | "md" | "txt";

const formats: Array<{
  value: NativeFormat;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  { value: "docx", label: "Doc", description: "Rich document", icon: FileText },
  { value: "xlsx", label: "Sheet", description: "Spreadsheet", icon: Sheet },
  {
    value: "pptx",
    label: "Slides",
    description: "Presentation",
    icon: Presentation,
  },
  {
    value: "md",
    label: "Markdown",
    description: "Formatted text",
    icon: Sparkles,
  },
  { value: "txt", label: "Text", description: "Plain text", icon: FileText },
];

export function DocumentCreateForm({
  projects,
  tasks,
}: {
  projects: ProjectOption[];
  tasks: TaskOption[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<NativeFormat>("docx");
  const [projectId, setProjectId] = useState("none");
  const [taskId, setTaskId] = useState("none");
  const [pending, setPending] = useState(false);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/documents/native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: data.get("fileName"),
          format,
          ...(format === "txt" || format === "md" ? { content: "" } : {}),
          projectId,
          taskId,
        }),
      });
      const payload = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error || "The file could not be created.");
      }
      toast.success("File created.");
      router.push(`/documents/${payload.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creation failed.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={createDocument} className="border-t bg-background">
      <div className="mx-auto grid max-w-4xl gap-7 px-4 py-10 sm:px-6">
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">File type</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {formats.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                disabled={pending}
                className={`grid min-h-24 place-items-center gap-1 border p-3 text-center transition-colors ${format === value ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:bg-muted"}`}
                aria-pressed={format === value}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="text-xs">{description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="new-document-name">Name</Label>
          <Input
            id="new-document-name"
            name="fileName"
            defaultValue="Untitled"
            maxLength={255}
            disabled={pending}
            required
            autoFocus
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="new-document-project">Project</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={pending}
            >
              <SelectTrigger id="new-document-project" className="w-full">
                <SelectValue />
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-document-task">Task</Label>
            <Select value={taskId} onValueChange={setTaskId} disabled={pending}>
              <SelectTrigger id="new-document-task" className="w-full">
                <SelectValue />
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
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending} className="min-w-32">
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
            {pending ? "Creating..." : "Create file"}
          </Button>
        </div>
      </div>
    </form>
  );
}
