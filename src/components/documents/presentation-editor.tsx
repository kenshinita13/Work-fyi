"use client";

import { Download, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PresentationState } from "@/lib/documents/office-types";

type PresentationEditorProps = {
  documentId: string;
  initialFileName: string;
  initialState: PresentationState;
  initialRevision: number;
  canEdit: boolean;
};

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "The presentation could not be saved.";
  } catch {
    return "The presentation could not be saved.";
  }
}

export function PresentationEditor({
  documentId,
  initialFileName,
  initialState,
  initialRevision,
  canEdit,
}: PresentationEditorProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState(initialFileName);
  const [state, setState] = useState(initialState);
  const [activeSlide, setActiveSlide] = useState(0);
  const [revision, setRevision] = useState(initialRevision);
  const [saving, setSaving] = useState(false);
  const slide = state.slides[activeSlide];

  function updateSlide(update: Partial<typeof slide>) {
    setState((current) => ({
      ...current,
      slides: current.slides.map((item, index) =>
        index === activeSlide ? { ...item, ...update } : item,
      ),
    }));
  }

  function addSlide() {
    if (state.slides.length >= 50) return;
    const nextIndex = state.slides.length;
    setState((current) => ({
      ...current,
      slides: [
        ...current.slides,
        {
          id: crypto.randomUUID(),
          title: `Slide ${nextIndex + 1}`,
          body: "",
          accent: slide.accent,
        },
      ],
    }));
    setActiveSlide(nextIndex);
  }

  function removeSlide() {
    if (state.slides.length === 1) return;
    setState((current) => ({
      ...current,
      slides: current.slides.filter((_, index) => index !== activeSlide),
    }));
    setActiveSlide((current) => Math.max(0, current - 1));
  }

  async function savePresentation() {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorKind: "presentation",
          fileName,
          editorState: state,
          expectedRevision: revision,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as {
        revision: number;
        fileName: string;
      };
      setRevision(payload.revision);
      setFileName(payload.fileName);
      toast.success("Presentation saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Input
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          disabled={!canEdit || saving}
          aria-label="Presentation name"
          className="min-w-56 max-w-md flex-1 font-medium"
        />
        {canEdit && (
          <label className="flex h-9 items-center gap-2 border-l pl-3 text-sm text-muted-foreground">
            Accent
            <input
              type="color"
              value={slide.accent}
              onChange={(event) => updateSlide({ accent: event.target.value })}
              className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Slide accent color"
            />
          </label>
        )}
        <Button variant="outline" asChild title="Export PPTX">
          <a href={`/api/documents/${documentId}/download`}>
            <Download className="size-4" aria-hidden="true" />
            Export
          </a>
        </Button>
        {canEdit && (
          <Button type="button" onClick={savePresentation} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <div className="grid min-h-[720px] grid-cols-[150px_minmax(0,1fr)] bg-muted/30 sm:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-r bg-background p-3">
          <div className="mb-3 flex items-center gap-1">
            {canEdit && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addSlide}
                  disabled={state.slides.length >= 50}
                  className="flex-1"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Slide
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={removeSlide}
                  disabled={state.slides.length === 1}
                  title="Delete slide"
                  aria-label="Delete slide"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
          <div className="grid gap-3">
            {state.slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSlide(index)}
                className={`grid aspect-video w-full grid-cols-[4px_1fr] overflow-hidden border bg-white text-left shadow-sm ${index === activeSlide ? "ring-2 ring-primary" : "hover:border-foreground/30"}`}
                aria-label={`Open slide ${index + 1}`}
              >
                <span
                  style={{ backgroundColor: item.accent }}
                  aria-hidden="true"
                />
                <span className="truncate p-2 text-[10px] font-semibold text-slate-800">
                  {item.title || `Slide ${index + 1}`}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 items-center justify-center overflow-auto p-4 sm:p-8">
          <div className="relative aspect-video w-full max-w-5xl overflow-hidden bg-white shadow-md">
            <span
              className="absolute inset-y-0 left-0 w-2"
              style={{ backgroundColor: slide.accent }}
              aria-hidden="true"
            />
            <div className="grid h-full grid-rows-[auto_1fr] gap-6 p-8 pl-10 sm:p-14 sm:pl-16">
              <Textarea
                value={slide.title}
                onChange={(event) => updateSlide({ title: event.target.value })}
                disabled={!canEdit}
                aria-label="Slide title"
                placeholder="Slide title"
                rows={2}
                className="max-h-28 resize-none border-0 p-0 text-2xl font-semibold text-slate-900 shadow-none focus-visible:ring-0 sm:text-3xl"
              />
              <Textarea
                value={slide.body}
                onChange={(event) => updateSlide({ body: event.target.value })}
                disabled={!canEdit}
                aria-label="Slide content"
                placeholder="Add slide content"
                className="h-full resize-none border-0 p-0 text-base leading-7 text-slate-700 shadow-none focus-visible:ring-0 sm:text-lg"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
