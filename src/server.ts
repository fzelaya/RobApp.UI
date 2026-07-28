import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import * as path from "path";
import { validateFilename } from "./filenameValidator";
import { extractFromBuffer, DocxExtractionError } from "./docxExtractor";
import { appendRow, ensureWorkbookExists, WORKBOOK_PATH, WORKBOOK_FILENAME } from "./workbookStore";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB is generous for a text-only report

// Keep the upload in memory -- we never want to write a file to disk under
// a name that came from the client.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

app.post("/api/extract", (req: Request, res: Response) => {
  upload.single("report")(req, res, async (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB).`
          : "Upload failed.";
      return res.status(400).json({ error: message });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file was uploaded." });
    }

    // Validate the filename first -- extension must be .docx, and the name
    // itself can't contain unsafe or disallowed characters. This runs
    // server-side regardless of whatever the browser already checked,
    // since client-side checks can be bypassed.
    // Note: Multer/Busboy already reduces the incoming filename to its
    // basename before exposing it as `originalname`, so a value like
    // "../../etc/report.docx" arrives here as "report.docx" -- the
    // directory-traversal attempt never reaches this validator at all.
    // The ".." check in validateFilename() below still matters for a
    // literal ".." with no slashes (e.g. "report..docx"), which Multer
    // does NOT strip.
    const originalName = file.originalname;
    const validation = validateFilename(originalName);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.reason,
        field: "filename",
      });
    }

    // Validate content, not just the name/extension -- a renamed .txt
    // pretending to be .docx should still be rejected, with a clear reason.
    let result;
    try {
      result = await extractFromBuffer(file.buffer, originalName);
    } catch (extractErr) {
      if (extractErr instanceof DocxExtractionError) {
        return res.status(400).json({ error: extractErr.message, field: "content" });
      }
      console.error(extractErr);
      return res.status(500).json({ error: "Unexpected error while reading the document." });
    }

    // Append to the ONE shared workbook (data/strategy-reports.xlsx) rather
    // than generating a fresh file per upload. appendRow() opens the
    // existing file, adds a row, and saves it back -- serialized so
    // simultaneous uploads can't race each other and drop a row.
    try {
      const outcome = await appendRow(result);
      res.set("X-Row-Number", String(outcome.rowNumber));
      res.set("X-Total-Rows", String(outcome.totalRows));
      res.download(WORKBOOK_PATH, WORKBOOK_FILENAME, (downloadErr) => {
        if (downloadErr) console.error(downloadErr);
      });
    } catch (writeErr) {
      console.error(writeErr);
      res.status(500).json({ error: "Failed to update the shared spreadsheet." });
    }
  });
});

// Lets the UI (or anyone) fetch the current shared workbook without
// uploading anything -- e.g. a "download what's been collected so far" link.
app.get("/api/download", async (_req: Request, res: Response) => {
  try {
    await ensureWorkbookExists();
    res.download(WORKBOOK_PATH, WORKBOOK_FILENAME);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not read the shared spreadsheet." });
  }
});

// Fallback error handler (e.g. malformed multipart body).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(400).json({ error: "Malformed request." });
});

ensureWorkbookExists()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Strategy report extractor listening on http://localhost:${PORT}`);
      console.log(`Shared workbook: ${WORKBOOK_PATH}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize the shared workbook:", err);
    process.exit(1);
  });
