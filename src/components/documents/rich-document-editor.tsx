"use client";

import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Save,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GooglePublishButton } from "@/components/documents/google-publish-button";
import type { RichDocumentState } from "@/lib/documents/office-types";

type RichDocumentEditorProps = {
  documentId: string;
  initialFileName: string;
  initialState: RichDocumentState;
  initialRevision: number;
  canEdit: boolean;
  initialGoogleUrl?: string | null;
  googleConnected: boolean;
};

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "The document could not be saved.";
  } catch {
    return "The document could not be saved.";
  }
}

export function RichDocumentEditor({
  documentId,
  initialFileName,
  initialState,
  initialRevision,
  canEdit,
  initialGoogleUrl,
  googleConnected,
}: RichDocumentEditorProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState(initialFileName);
  const [revision, setRevision] = useState(initialRevision);
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialState.document,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[680px] outline-none [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h1]:mb-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mb-4 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:list-disc",
      },
    },
  });

  async function saveDocument() {
    if (!editor || !canEdit || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorKind: "rich_document",
          fileName,
          editorState: { version: 1, document: editor.getJSON() },
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
      toast.success("Document saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const commandButtons = [
    {
      label: "Bold",
      icon: Bold,
      active: "bold",
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: "italic",
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: "underline",
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: "strike",
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      label: "Bulleted list",
      icon: List,
      active: "bulletList",
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: "orderedList",
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: "blockquote",
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="border-t bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Input
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            disabled={!canEdit || saving}
            aria-label="Document name"
            className="min-w-56 max-w-md flex-1 font-medium"
          />
          <div className="flex items-center gap-0.5 border-l pl-2">
            {commandButtons.map(({ label, icon: Icon, active, run }) => (
              <Button
                key={label}
                type="button"
                size="icon-sm"
                variant={editor?.isActive(active) ? "secondary" : "ghost"}
                onClick={run}
                disabled={!canEdit || !editor}
                title={label}
                aria-label={label}
              >
                <Icon className="size-4" aria-hidden="true" />
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 border-l pl-2">
            {[AlignLeft, AlignCenter, AlignRight].map((Icon, index) => {
              const alignment = ["left", "center", "right"][index];
              return (
                <Button
                  key={alignment}
                  type="button"
                  size="icon-sm"
                  variant={
                    editor?.isActive({ textAlign: alignment })
                      ? "secondary"
                      : "ghost"
                  }
                  onClick={() =>
                    editor?.chain().focus().setTextAlign(alignment).run()
                  }
                  disabled={!canEdit || !editor}
                  title={`Align ${alignment}`}
                  aria-label={`Align ${alignment}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </Button>
              );
            })}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!canEdit || !editor?.can().undo()}
              title="Undo"
              aria-label="Undo"
            >
              <Undo2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!canEdit || !editor?.can().redo()}
              title="Redo"
              aria-label="Redo"
            >
              <Redo2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Button variant="outline" asChild title="Export DOCX">
            <a href={`/api/documents/${documentId}/download`}>
              <Download className="size-4" aria-hidden="true" />
              Export
            </a>
          </Button>
          {canEdit && (
            <GooglePublishButton
              documentId={documentId}
              revision={revision}
              target="docs"
              initialUrl={initialGoogleUrl}
              connected={googleConnected}
            />
          )}
          {canEdit && (
            <Button
              type="button"
              onClick={saveDocument}
              disabled={saving || !editor}
            >
              <Save className="size-4" aria-hidden="true" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-[760px] overflow-auto bg-muted/30 px-4 py-8 sm:px-8">
        <div className="mx-auto min-h-[900px] w-full max-w-[850px] bg-background px-8 py-12 shadow-sm sm:px-16">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
