import type { JSONContent } from "@tiptap/core";

export type RichDocumentState = {
  version: 1;
  document: JSONContent;
};

export type SpreadsheetSheet = {
  id: string;
  name: string;
  cells: string[][];
};

export type SpreadsheetState = {
  version: 1;
  sheets: SpreadsheetSheet[];
};

export type PresentationSlide = {
  id: string;
  title: string;
  body: string;
  accent: string;
};

export type PresentationState = {
  version: 1;
  slides: PresentationSlide[];
};

export type OfficeEditorState =
  RichDocumentState | SpreadsheetState | PresentationState;

export function createRichDocumentState(): RichDocumentState {
  return {
    version: 1,
    document: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

export function createSpreadsheetState(): SpreadsheetState {
  return {
    version: 1,
    sheets: [
      {
        id: crypto.randomUUID(),
        name: "Sheet 1",
        cells: Array.from({ length: 20 }, () => Array(8).fill("")),
      },
    ],
  };
}

export function createPresentationState(): PresentationState {
  return {
    version: 1,
    slides: [
      {
        id: crypto.randomUUID(),
        title: "Untitled presentation",
        body: "",
        accent: "#2563eb",
      },
    ],
  };
}
