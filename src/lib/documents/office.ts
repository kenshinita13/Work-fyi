import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html/server";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import PptxGenJS from "pptxgenjs";

import {
  createRichDocumentState,
  createSpreadsheetState,
  type PresentationState,
  type RichDocumentState,
  type SpreadsheetState,
} from "@/lib/documents/office-types";
import type { DocumentEditorKind } from "@/types/database";

const richExtensions = [
  StarterKit,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

function markEnabled(node: JSONContent, type: string) {
  return node.marks?.some((mark) => mark.type === type) ?? false;
}

function inlineRuns(node: JSONContent): TextRun[] {
  if (node.type === "text") {
    return [
      new TextRun({
        text: node.text ?? "",
        bold: markEnabled(node, "bold"),
        italics: markEnabled(node, "italic"),
        underline: markEnabled(node, "underline") ? {} : undefined,
        strike: markEnabled(node, "strike"),
        font: markEnabled(node, "code") ? "Consolas" : undefined,
      }),
    ];
  }
  if (node.type === "hardBreak") return [new TextRun({ break: 1 })];
  return node.content?.flatMap(inlineRuns) ?? [];
}

function alignmentFor(node: JSONContent) {
  const alignment = node.attrs?.textAlign;
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right") return AlignmentType.RIGHT;
  if (alignment === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function richNodeToParagraphs(
  node: JSONContent,
  listStyle?: "bullet" | "number",
): Paragraph[] {
  if (node.type === "bulletList" || node.type === "orderedList") {
    const style = node.type === "bulletList" ? "bullet" : "number";
    return (
      node.content?.flatMap((child) => richNodeToParagraphs(child, style)) ?? []
    );
  }
  if (node.type === "listItem") {
    return (
      node.content?.flatMap((child) =>
        richNodeToParagraphs(child, listStyle),
      ) ?? []
    );
  }
  if (node.type === "horizontalRule") {
    return [
      new Paragraph({ text: "________________________________________" }),
    ];
  }
  if (node.type === "blockquote") {
    return (node.content ?? []).map(
      (child) =>
        new Paragraph({
          children: [
            new TextRun({ text: "> ", italics: true }),
            ...inlineRuns(child),
          ],
          indent: { left: 360 },
        }),
    );
  }

  const baseOptions: IParagraphOptions = {
    children: inlineRuns(node),
    alignment: alignmentFor(node),
  };
  if (node.type === "heading") {
    const level = Number(node.attrs?.level ?? 1);
    const heading =
      level === 1
        ? HeadingLevel.HEADING_1
        : level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3;
    return [new Paragraph({ ...baseOptions, heading })];
  }
  if (node.type === "codeBlock") {
    return [
      new Paragraph({
        ...baseOptions,
        children: [
          new TextRun({
            text: node.content?.map((child) => child.text ?? "").join("") ?? "",
            font: "Consolas",
          }),
        ],
      }),
    ];
  }
  if (listStyle === "bullet") {
    return [new Paragraph({ ...baseOptions, bullet: { level: 0 } })];
  }
  if (listStyle === "number") {
    return [
      new Paragraph({
        ...baseOptions,
        numbering: { reference: "office-list", level: 0 },
      }),
    ];
  }
  return [new Paragraph(baseOptions)];
}

export async function exportRichDocument(state: RichDocumentState) {
  const children =
    state.document.content?.flatMap((node) => richNodeToParagraphs(node)) ?? [];
  const document = new Document({
    numbering: {
      config: [
        {
          reference: "office-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children: children.length ? children : [new Paragraph("")] }],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

export async function importRichDocument(
  buffer: Buffer,
): Promise<RichDocumentState> {
  const converted = await mammoth.convertToHtml({ buffer });
  const state = createRichDocumentState();
  state.document = generateJSON(converted.value || "<p></p>", richExtensions);
  return state;
}

export async function exportSpreadsheet(state: SpreadsheetState) {
  const workbook = new ExcelJS.Workbook();
  for (const sheetState of state.sheets) {
    const sheet = workbook.addWorksheet(sheetState.name.slice(0, 31));
    sheetState.cells.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        sheet.getCell(rowIndex + 1, columnIndex + 1).value = value;
      });
    });
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function importSpreadsheet(
  buffer: Buffer,
): Promise<SpreadsheetState> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const state = createSpreadsheetState();
  state.sheets = workbook.worksheets.slice(0, 10).map((worksheet) => {
    const rowCount = Math.max(20, Math.min(200, worksheet.actualRowCount));
    const columnCount = Math.max(8, Math.min(50, worksheet.actualColumnCount));
    return {
      id: crypto.randomUUID(),
      name: worksheet.name.slice(0, 50) || "Sheet",
      cells: Array.from({ length: rowCount }, (_, rowIndex) =>
        Array.from({ length: columnCount }, (_, columnIndex) =>
          worksheet
            .getCell(rowIndex + 1, columnIndex + 1)
            .text.slice(0, 10_000),
        ),
      ),
    };
  });
  return state.sheets.length ? state : createSpreadsheetState();
}

export async function exportPresentation(state: PresentationState) {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "Work.fyi";
  presentation.subject = "Work.fyi presentation";
  for (const slideState of state.slides) {
    const slide = presentation.addSlide();
    const accent = slideState.accent.replace("#", "");
    slide.background = { color: "F8FAFC" };
    slide.addShape(presentation.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.18,
      h: 7.5,
      fill: { color: accent },
      line: { color: accent },
    });
    slide.addText(slideState.title || "Untitled slide", {
      x: 0.75,
      y: 0.75,
      w: 11.6,
      h: 0.75,
      fontFace: "Aptos Display",
      fontSize: 28,
      bold: true,
      color: "172033",
      margin: 0,
    });
    slide.addText(slideState.body, {
      x: 0.78,
      y: 1.8,
      w: 11.3,
      h: 4.7,
      fontFace: "Aptos",
      fontSize: 18,
      color: "334155",
      breakLine: false,
      margin: 0,
      valign: "top",
    });
  }
  const output = await presentation.write({
    outputType: "uint8array",
    compression: true,
  });
  if (!(output instanceof Uint8Array))
    throw new Error("Presentation export failed.");
  return output;
}

export async function exportOfficeEditorState(
  kind: Exclude<DocumentEditorKind, "text">,
  state: RichDocumentState | SpreadsheetState | PresentationState,
) {
  if (kind === "rich_document" && "document" in state) {
    return exportRichDocument(state);
  }
  if (kind === "spreadsheet" && "sheets" in state) {
    return exportSpreadsheet(state);
  }
  if (kind === "presentation" && "slides" in state) {
    return exportPresentation(state);
  }
  throw new Error("The editor state does not match the requested Office file.");
}

export function officeStateText(
  state: RichDocumentState | SpreadsheetState | PresentationState,
) {
  if ("document" in state) {
    const text: string[] = [];
    const visit = (node: JSONContent) => {
      if (node.text) text.push(node.text);
      node.content?.forEach(visit);
    };
    visit(state.document);
    return text.join(" ");
  }
  if ("sheets" in state) {
    return state.sheets
      .flatMap((sheet) => sheet.cells.flat())
      .filter(Boolean)
      .join(" ");
  }
  return state.slides.flatMap((slide) => [slide.title, slide.body]).join(" ");
}
