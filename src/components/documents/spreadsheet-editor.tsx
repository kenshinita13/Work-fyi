"use client";

import {
  Download,
  FilePlus2,
  Plus,
  Save,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SpreadsheetState } from "@/lib/documents/office-types";

type SpreadsheetEditorProps = {
  documentId: string;
  initialFileName: string;
  initialState: SpreadsheetState;
  initialRevision: number;
  canEdit: boolean;
};

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "The spreadsheet could not be saved.";
  } catch {
    return "The spreadsheet could not be saved.";
  }
}

export function SpreadsheetEditor({
  documentId,
  initialFileName,
  initialState,
  initialRevision,
  canEdit,
}: SpreadsheetEditorProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState(initialFileName);
  const [state, setState] = useState(initialState);
  const [activeSheet, setActiveSheet] = useState(0);
  const [revision, setRevision] = useState(initialRevision);
  const [saving, setSaving] = useState(false);
  const sheet = state.sheets[activeSheet];
  const columnCount = Math.max(1, ...sheet.cells.map((row) => row.length));

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((currentSheet, sheetIndex) =>
        sheetIndex !== activeSheet
          ? currentSheet
          : {
              ...currentSheet,
              cells: currentSheet.cells.map((row, index) =>
                index !== rowIndex
                  ? row
                  : Array.from(
                      { length: Math.max(row.length, columnIndex + 1) },
                      (_, cellIndex) =>
                        cellIndex === columnIndex
                          ? value
                          : (row[cellIndex] ?? ""),
                    ),
              ),
            },
      ),
    }));
  }

  function addRow() {
    if (sheet.cells.length >= 200) return;
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((currentSheet, index) =>
        index === activeSheet
          ? {
              ...currentSheet,
              cells: [...currentSheet.cells, Array(columnCount).fill("")],
            }
          : currentSheet,
      ),
    }));
  }

  function renameSheet(name: string) {
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((currentSheet, index) =>
        index === activeSheet ? { ...currentSheet, name } : currentSheet,
      ),
    }));
  }

  function addColumn() {
    if (columnCount >= 50) return;
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((currentSheet, index) =>
        index === activeSheet
          ? {
              ...currentSheet,
              cells: currentSheet.cells.map((row) => [...row, ""]),
            }
          : currentSheet,
      ),
    }));
  }

  function addSheet() {
    if (state.sheets.length >= 10) return;
    const nextIndex = state.sheets.length;
    setState((current) => ({
      ...current,
      sheets: [
        ...current.sheets,
        {
          id: crypto.randomUUID(),
          name: `Sheet ${nextIndex + 1}`,
          cells: Array.from({ length: 20 }, () => Array(8).fill("")),
        },
      ],
    }));
    setActiveSheet(nextIndex);
  }

  function removeSheet() {
    if (state.sheets.length === 1) return;
    setState((current) => ({
      ...current,
      sheets: current.sheets.filter((_, index) => index !== activeSheet),
    }));
    setActiveSheet((current) => Math.max(0, current - 1));
  }

  async function saveSpreadsheet() {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorKind: "spreadsheet",
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
      toast.success("Spreadsheet saved.");
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
          aria-label="Spreadsheet name"
          className="min-w-56 max-w-md flex-1 font-medium"
        />
        {canEdit && (
          <>
            <Input
              value={sheet.name}
              onChange={(event) => renameSheet(event.target.value)}
              maxLength={50}
              aria-label="Sheet name"
              className="w-32"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={addRow}
              disabled={sheet.cells.length >= 200}
              title="Add row"
              aria-label="Add row"
            >
              <TableRowsSplit className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={addColumn}
              disabled={columnCount >= 50}
              title="Add column"
              aria-label="Add column"
            >
              <TableColumnsSplit className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
        <Button variant="outline" asChild title="Export XLSX">
          <a href={`/api/documents/${documentId}/download`}>
            <Download className="size-4" aria-hidden="true" />
            Export
          </a>
        </Button>
        {canEdit && (
          <Button type="button" onClick={saveSpreadsheet} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <div className="max-h-[720px] overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th
                className="sticky left-0 z-20 h-8 w-12 min-w-12 border-r border-b bg-muted"
                aria-label="Row number"
              />
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <th
                  key={columnIndex}
                  className="h-8 min-w-36 border-r border-b px-2 text-center font-medium text-muted-foreground"
                >
                  {columnName(columnIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="sticky left-0 z-[1] h-9 border-r border-b bg-muted px-2 text-center font-medium text-muted-foreground">
                  {rowIndex + 1}
                </th>
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="h-9 min-w-36 border-r border-b p-0"
                  >
                    <input
                      value={row[columnIndex] ?? ""}
                      onChange={(event) =>
                        updateCell(rowIndex, columnIndex, event.target.value)
                      }
                      disabled={!canEdit}
                      aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                      className="h-9 w-36 bg-transparent px-2 outline-none focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-default"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-h-11 items-center gap-1 overflow-x-auto border-t bg-muted/40 px-3">
        {state.sheets.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSheet(index)}
            className={`h-9 shrink-0 border-b-2 px-3 text-sm ${index === activeSheet ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {item.name}
          </button>
        ))}
        {canEdit && (
          <>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={addSheet}
              disabled={state.sheets.length >= 10}
              title="Add sheet"
              aria-label="Add sheet"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={removeSheet}
              disabled={state.sheets.length === 1}
              title="Delete sheet"
              aria-label="Delete sheet"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}
        {!canEdit && (
          <FilePlus2
            className="ml-auto size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
