#!/usr/bin/env node
import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";
import { extractFromDocx, DocxExtractionError } from "./docxExtractor";
import { writeResultsToExcel } from "./excelExporter";
import { appendRow, WORKBOOK_PATH } from "./workbookStore";

const program = new Command();

program
  .name("extract-report")
  .description(
    "Extracts strategy performance metrics from one or more Word (.docx) reports. " +
      "By default, each report is appended as a new row to the shared workbook at " +
      "data/strategy-reports.xlsx -- the same file the web upload page writes to. " +
      "Pass --out to write a separate, standalone file instead."
  )
  .argument("<inputs...>", "Path(s) to .docx report file(s), or a directory containing them")
  .option(
    "-o, --out <file>",
    "Write a standalone .xlsx here instead of appending to the shared workbook " +
      "(overwrites <file> if it exists; one row per input)"
  )
  .option("--strict", "Exit with a non-zero code if any required field is missing from any file", false)
  .action(async (inputs: string[], options: { out?: string; strict: boolean }) => {
    const files = resolveInputFiles(inputs);

    if (files.length === 0) {
      console.error("No .docx files found for the given input(s).");
      process.exitCode = 1;
      return;
    }

    const results = [];
    let hadMissingFields = false;
    let hadFailures = false;

    for (const file of files) {
      try {
        const result = await extractFromDocx(file);
        results.push(result);

        if (result.missingRequired.length > 0) {
          hadMissingFields = true;
          console.warn(
            `[warn] ${path.basename(file)}: missing ${result.missingRequired.length} field(s): ` +
              result.missingRequired.join(", ")
          );
        } else {
          console.log(`[ok]   ${path.basename(file)}: all fields extracted.`);
        }
      } catch (err) {
        hadFailures = true;
        if (err instanceof DocxExtractionError) {
          console.error(`[error] ${path.basename(file)}: ${err.message}`);
        } else {
          console.error(`[error] ${path.basename(file)}: unexpected failure - ${(err as Error).message}`);
        }
        // Continue processing the remaining files instead of aborting the whole batch.
      }
    }

    if (results.length === 0) {
      console.error("No files were extracted successfully; nothing to write.");
      process.exitCode = 1;
      return;
    }

    if (options.out) {
      await writeResultsToExcel(results, options.out);
      console.log(`\nWrote ${results.length} row(s) to standalone file: ${options.out}`);
    } else {
      for (const result of results) {
        const outcome = await appendRow(result);
        console.log(
          `[appended] ${path.basename(result.sourceFile)} -> row ${outcome.rowNumber} ` +
            `(${outcome.totalRows} total rows)`
        );
      }
      console.log(`\nUpdated shared workbook: ${WORKBOOK_PATH}`);
    }

    if (hadFailures) {
      process.exitCode = 1;
    } else if (options.strict && hadMissingFields) {
      process.exitCode = 2;
    }
  });

/** Expands directories into their contained .docx files; passes files through as-is. */
function resolveInputFiles(inputs: string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    if (!fs.existsSync(input)) {
      console.error(`[warn] Path does not exist, skipping: ${input}`);
      continue;
    }
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      const entries = fs
        .readdirSync(input)
        .filter((f) => f.toLowerCase().endsWith(".docx") && !f.startsWith("~$")); // skip Word lock files
      out.push(...entries.map((f) => path.join(input, f)));
    } else {
      out.push(input);
    }
  }
  return out;
}

program.parseAsync(process.argv);
