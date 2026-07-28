import * as fs from "fs";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { normalizeLabel, FIELD_SPECS } from "./fields";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const select = xpath.useNamespaces({ w: WORD_NS });

export class DocxExtractionError extends Error {}

export interface ExtractionResult {
  /** header -> extracted value (string) or null if not found */
  values: Record<string, string | null>;
  /** headers that were required (not optional) but not found in the document */
  missingRequired: string[];
  /** source file name, for traceability in the spreadsheet / logs */
  sourceFile: string;
}

/**
 * Parses word/document.xml out of a .docx (which is a zip container),
 * given its raw bytes. `label` is only used to make error messages
 * readable (a file path for the CLI, an original upload name for the web
 * server -- either way, never used as a filesystem path here).
 */
async function loadDocumentXmlFromBuffer(buffer: Buffer, label: string): Promise<Document> {
  // Basic sanity check: .docx files are zip archives, which start with "PK".
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new DocxExtractionError(
      `"${label}" does not look like a valid .docx file (not a zip archive). ` +
        `Only .docx is supported -- .doc (legacy binary Word format) is not.`
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new DocxExtractionError(
      `Could not open "${label}" as a .docx package: ${(err as Error).message}`
    );
  }

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new DocxExtractionError(
      `"${label}" is a zip file but is missing word/document.xml -- ` +
        `it doesn't appear to be a valid Word document.`
    );
  }

  const xml = await docXmlFile.async("string");
  const doc = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg) => {
        throw new DocxExtractionError(`Malformed XML in word/document.xml: ${msg}`);
      },
      fatalError: (msg) => {
        throw new DocxExtractionError(`Malformed XML in word/document.xml: ${msg}`);
      },
    },
  }).parseFromString(xml, "text/xml");

  return doc;
}

/**
 * Extracts the plain text of a <w:tc> table cell, including text that is
 * nested inside a Structured Document Tag / content control (<w:sdt>).
 *
 * This matters because report templates like the one this app targets wrap
 * several "fill-in" cells in <w:sdt><w:sdtContent><w:tc>...</w:tc></w:sdtContent></w:sdt>.
 * That nesting makes the <w:tc> a *grandchild* of <w:tr> instead of a direct
 * child, which breaks libraries (and hand-rolled code) that only look at
 * direct <w:tc> children of each row. Using the `.//w:t` descendant search
 * below sidesteps that entirely.
 */
function cellText(cellNode: Node): string {
  const textNodes = select(".//w:t", cellNode) as Node[];
  return textNodes.map((n) => n.textContent || "").join("");
}

/**
 * Returns every <w:tc> cell within a row, in document order, regardless of
 * whether it's a direct child of the row or nested inside an <w:sdt> content
 * control. This is the key trick that makes extraction robust to the
 * content-control formatting variations Word report generators produce.
 */
function rowCells(rowNode: Node): Node[] {
  return select(".//w:tc", rowNode) as Node[];
}

/**
 * Walks every table/row in the document and builds a label -> value map by
 * pairing each cell whose text ends in a colon with the cell immediately
 * following it. This mirrors the report's actual layout: labels and values
 * always appear as adjacent cells, even though a row may contain two
 * label/value pairs side by side (e.g. "Total Net Profit:" / value / blank
 * spacer / "Profit Factor:" / value).
 */
function extractLabelValuePairs(doc: Document): Map<string, string> {
  const pairs = new Map<string, string>();
  const tables = select("//w:tbl", doc) as Node[];

  for (const table of tables) {
    const rows = select("./w:tr", table) as Node[];
    for (const row of rows) {
      const cells = rowCells(row).map((c) => cellText(c));
      for (let i = 0; i < cells.length - 1; i++) {
        const text = cells[i].trim();
        if (text.endsWith(":")) {
          const label = normalizeLabel(text);
          const value = cells[i + 1].trim();
          // First match wins; later duplicate labels (rare) are ignored
          // rather than silently overwriting a good value.
          if (!pairs.has(label)) {
            pairs.set(label, value);
          }
        }
      }
    }
  }
  return pairs;
}

export async function extractFromDocx(filePath: string): Promise<ExtractionResult> {
  if (!fs.existsSync(filePath)) {
    throw new DocxExtractionError(`File not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return extractFromBuffer(buffer, filePath);
}

/**
 * Same extraction logic as extractFromDocx, but from an in-memory buffer.
 * Used by the web upload endpoint, which should never write an
 * attacker-controlled filename straight to disk.
 */
export async function extractFromBuffer(
  buffer: Buffer,
  sourceLabel: string
): Promise<ExtractionResult> {
  const doc = await loadDocumentXmlFromBuffer(buffer, sourceLabel);
  const pairs = extractLabelValuePairs(doc);

  const values: Record<string, string | null> = {};
  const missingRequired: string[] = [];

  for (const spec of FIELD_SPECS) {
    let found: string | null = null;
    for (const alias of spec.aliases) {
      const key = normalizeLabel(alias);
      if (pairs.has(key)) {
        const v = pairs.get(key)!;
        found = v.length > 0 ? v : null;
        break;
      }
    }
    values[spec.header] = found;
    if (found === null && !spec.optional) {
      missingRequired.push(spec.header);
    }
  }

  return {
    values,
    missingRequired,
    sourceFile: sourceLabel,
  };
}
