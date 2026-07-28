import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import { ExtractionResult } from "./docxExtractor";
import { SHEET_NAME, HEADERS, initializeSheet, appendResultRow } from "./excelExporter";

/**
 * The single shared workbook that every extraction -- from the web upload
 * form or the CLI -- appends a row to. Lives in <project root>/data so it
 * persists across restarts and deploys, and every consumer opens the exact
 * same file rather than each producing its own throwaway output.
 *
 * __dirname at runtime is <project root>/dist, so "../data" resolves to
 * <project root>/data regardless of the current working directory the
 * process happens to be started from.
 */
export const DATA_DIR = path.join(__dirname, "..", "data");
export const WORKBOOK_FILENAME = "strategy-reports.xlsx";
export const WORKBOOK_PATH = path.join(DATA_DIR, WORKBOOK_FILENAME);

/**
 * Simple async mutex: every call to withLock() is queued behind whatever
 * is already running, so two near-simultaneous uploads can never read the
 * same "before" state of the workbook and both append based on it (which
 * would silently drop one row). A single Node process is enough for this
 * app's expected scale; if this ever needs multiple server processes/
 * machines, this in-memory queue would need to become a real file lock or
 * move the row storage into a database instead.
 */
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  // Swallow rejections here so one failed task doesn't permanently wedge
  // the queue for later tasks -- the caller of withLock still sees the
  // rejection via the returned promise.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Creates data/ and an empty (header-only) workbook if they don't exist yet. */
async function ensureWorkbookExistsUnlocked(): Promise<void> {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  if (fs.existsSync(WORKBOOK_PATH)) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "strategy-report-extractor";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(SHEET_NAME);
  initializeSheet(sheet);

  await atomicWrite(workbook);
}

/** Public, lock-safe version -- call this on server startup. */
export function ensureWorkbookExists(): Promise<void> {
  return withLock(ensureWorkbookExistsUnlocked);
}

/**
 * Writes a workbook to WORKBOOK_PATH atomically: write to a temp file in
 * the same directory, then rename over the real path. A rename on the same
 * filesystem is atomic, so a reader (or a crash) never sees a half-written
 * file -- worst case they see the previous complete version.
 */
async function atomicWrite(workbook: ExcelJS.Workbook): Promise<void> {
  const tmpPath = path.join(
    DATA_DIR,
    `.${WORKBOOK_FILENAME}.${process.pid}.${Date.now()}.tmp`
  );
  await workbook.xlsx.writeFile(tmpPath);
  await fs.promises.rename(tmpPath, WORKBOOK_PATH);
}

export interface AppendOutcome {
  /** 1-based row number the new data landed on (row 1 is the header). */
  rowNumber: number;
  /** Total data rows in the workbook after this append (excludes header). */
  totalRows: number;
}

/**
 * Opens the shared workbook, appends one row for `result`, and saves it
 * back to the same path -- serialized so concurrent uploads can't race
 * each other. This is the only way rows should ever be added to the
 * shared file.
 */
export async function appendRow(result: ExtractionResult): Promise<AppendOutcome> {
  return withLock(async () => {
    await ensureWorkbookExistsUnlocked();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(WORKBOOK_PATH);

    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) {
      // Defensive: someone replaced the file with one that has a
      // differently-named sheet. Re-create the expected sheet rather than
      // silently writing into the wrong place.
      sheet = workbook.addWorksheet(SHEET_NAME);
      initializeSheet(sheet);
    } else if (sheet.rowCount === 0) {
      initializeSheet(sheet);
    }

    const row = appendResultRow(sheet, result);
    await atomicWrite(workbook);

    return {
      rowNumber: row.number,
      totalRows: sheet.rowCount - 1, // minus the header row
    };
  });
}

export { HEADERS };
