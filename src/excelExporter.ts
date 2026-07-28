import ExcelJS from "exceljs";
import * as path from "path";
import { FIELD_SPECS } from "./fields";
import { ExtractionResult } from "./docxExtractor";
import { parseCell } from "./valueParser";

export const SHEET_NAME = "Strategy Report Data";
export const HEADERS = ["Source File", ...FIELD_SPECS.map((f) => f.header)];

/**
 * Applies the standard column widths/header styling to row 1 of a fresh
 * (or freshly re-created) worksheet. Shared by both the one-shot export
 * path and the persistent-workbook path so the two never drift apart.
 */
export function initializeSheet(sheet: ExcelJS.Worksheet): void {
  sheet.columns = HEADERS.map((h) => ({
    header: h,
    key: h,
    width: Math.max(14, Math.min(32, h.length + 2)),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, name: "Arial", size: 10 };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 30;

  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
}

/**
 * Appends one extraction result as a new row on the given worksheet,
 * applying number formats (currency/percent/number) and flagging any
 * missing required field in red. This is the single place that knows how
 * to turn an ExtractionResult into a spreadsheet row -- used both when
 * building a brand-new workbook and when appending to the persistent one.
 */
export function appendResultRow(sheet: ExcelJS.Worksheet, result: ExtractionResult): ExcelJS.Row {
  // Built positionally (index i -> HEADERS[i]) rather than as a keyed
  // object. ExcelJS's `sheet.addRow({headerText: value})` form depends on
  // in-memory column `key` metadata that only exists right after
  // `sheet.columns = [...]` is set on a freshly created sheet -- it is
  // NOT reconstructed when an existing workbook is reloaded from disk via
  // workbook.xlsx.readFile(). Using a plain array keeps this correct
  // whether the sheet was just created or just reopened.
  const rowArray: (string | number)[] = new Array(HEADERS.length).fill("");
  const cellFormats: Record<number, string> = {};

  rowArray[0] = path.basename(result.sourceFile);

  for (const spec of FIELD_SPECS) {
    const colIndex = HEADERS.indexOf(spec.header); // 0-based, matches rowArray
    const raw = result.values[spec.header];
    const parsed = parseCell(raw);
    switch (parsed.kind) {
      case "currency":
        rowArray[colIndex] = parsed.value;
        cellFormats[colIndex] = '"$"#,##0;[RED]-"$"#,##0';
        break;
      case "percent":
        rowArray[colIndex] = parsed.value;
        cellFormats[colIndex] = "0.0%";
        break;
      case "number":
        rowArray[colIndex] = parsed.value;
        cellFormats[colIndex] = "#,##0.00";
        break;
      case "text":
        rowArray[colIndex] = parsed.value;
        break;
      case "empty":
        rowArray[colIndex] = result.missingRequired.includes(spec.header) ? "MISSING" : "";
        break;
    }
  }

  const row = sheet.addRow(rowArray);
  row.font = { name: "Arial", size: 10 };

  for (const [colIndexStr, format] of Object.entries(cellFormats)) {
    // +1: ExcelJS cell/column numbers are 1-based, rowArray/HEADERS are 0-based.
    row.getCell(Number(colIndexStr) + 1).numFmt = format;
  }

  for (const missingHeader of result.missingRequired) {
    const colNumber = HEADERS.indexOf(missingHeader) + 1;
    const cell = row.getCell(colNumber);
    cell.font = { name: "Arial", size: 10, color: { argb: "FFCC0000" }, bold: true };
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  return row;
}

/**
 * One-shot export: builds a brand-new workbook from scratch and writes it
 * to outputPath, one row per result. This OVERWRITES outputPath -- it does
 * not read or preserve any existing file there. Used by the CLI's --out
 * flag for ad-hoc exports that are explicitly separate from the shared
 * tracking workbook (see workbookStore.ts for the persistent, appending
 * version used by the web app and by the CLI's default output).
 */
export async function writeResultsToExcel(
  results: ExtractionResult[],
  outputPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "strategy-report-extractor";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME);
  initializeSheet(sheet);

  for (const result of results) {
    appendResultRow(sheet, result);
  }

  await workbook.xlsx.writeFile(outputPath);
}
