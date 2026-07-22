import { describe, expect, it } from "vitest";

import {
  exportPresentation,
  exportRichDocument,
  exportSpreadsheet,
  importRichDocument,
  importSpreadsheet,
} from "@/lib/documents/office";
import { parseOfficeEditorState } from "@/lib/documents/office-state";
import {
  createPresentationState,
  createRichDocumentState,
  createSpreadsheetState,
} from "@/lib/documents/office-types";

describe("Office documents", () => {
  it("validates each native editor state", () => {
    expect(
      parseOfficeEditorState("rich_document", createRichDocumentState())
        .success,
    ).toBe(true);
    expect(
      parseOfficeEditorState("spreadsheet", createSpreadsheetState()).success,
    ).toBe(true);
    expect(
      parseOfficeEditorState("presentation", createPresentationState()).success,
    ).toBe(true);
  });

  it("rejects presentation state with unsafe colors", () => {
    const state = createPresentationState();
    state.slides[0].accent = "url(javascript:alert(1))";

    expect(parseOfficeEditorState("presentation", state).success).toBe(false);
  });

  it("rejects unsafe rich-document links", () => {
    const state = createRichDocumentState();
    state.document.content = [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Unsafe link",
            marks: [
              {
                type: "link",
                attrs: { href: "javascript:alert(1)" },
              },
            ],
          },
        ],
      },
    ];

    expect(parseOfficeEditorState("rich_document", state).success).toBe(false);
  });

  it("exports valid ZIP-based Office containers", async () => {
    const [docx, xlsx, pptx] = await Promise.all([
      exportRichDocument(createRichDocumentState()),
      exportSpreadsheet(createSpreadsheetState()),
      exportPresentation(createPresentationState()),
    ]);

    for (const file of [docx, xlsx, pptx]) {
      expect(file[0]).toBe(0x50);
      expect(file[1]).toBe(0x4b);
      expect(file.byteLength).toBeGreaterThan(1000);
    }
  });

  it("round-trips generated DOCX and XLSX into editable state", async () => {
    const docx = await exportRichDocument(createRichDocumentState());
    const xlsx = await exportSpreadsheet(createSpreadsheetState());

    const [documentState, spreadsheetState] = await Promise.all([
      importRichDocument(Buffer.from(docx)),
      importSpreadsheet(Buffer.from(xlsx)),
    ]);

    expect(documentState.document.type).toBe("doc");
    expect(spreadsheetState.sheets).toHaveLength(1);
    expect(spreadsheetState.sheets[0].cells.length).toBeGreaterThanOrEqual(20);
  });
});
