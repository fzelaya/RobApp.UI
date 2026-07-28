# Strategy Report Extractor

Extracts trading strategy performance metrics from Word (`.docx`) performance
reports and appends them as rows to a single shared Excel workbook —
`data/strategy-reports.xlsx`. Available both as a web upload page and a CLI,
and both write to the same file.

## Why this exists

Strategy performance reports (e.g. TradeStation/MultiCharts "Strategy
Performance Report" exports) contain ~47 metrics — net profit, drawdowns,
win/loss stats, Sharpe ratio, etc. — buried in a Word table. This tool reads
that table reliably and turns every report you upload into one row in a
running spreadsheet, so you can track strategies over time without manual
copy-paste.

## How extraction works

Report tables from these exporters often wrap several "fill-in" value cells
in Word Structured Document Tags / content controls (`<w:sdt>`). That
nesting makes the cell a *grandchild* of its table row instead of a direct
child, which silently breaks naive "read each cell in the row" logic —
including most off-the-shelf `.docx` libraries. Those cells just come back
blank.

To work around this, `src/docxExtractor.ts` parses `word/document.xml`
directly (via `jszip` + `xmldom` + `xpath`) and searches for `w:tc`
descendants regardless of `w:sdt` nesting, then pairs each `Label:` cell
with the cell immediately following it. This is robust to the formatting
quirks that break naive table readers.

`src/fields.ts` defines the canonical list of ~47 fields, their header text
for the spreadsheet, and label aliases/normalization to tolerate minor
wording variants across report exports. Two fields — **Winning Trades** and
**Losing Trades** — are section headers in these reports, not data points;
they're marked optional and won't be flagged as missing.

## The shared workbook

Every extraction — from the web page or the CLI — appends a row to
**`data/strategy-reports.xlsx`**. Nothing generates a separate throwaway
file per upload. Column A is always `Source File`; every field from
`fields.ts` gets its own header column, in a fixed order.

- The file (and `data/`) is created automatically on first run if missing.
- Writes are **atomic**: each append writes to a temp file in `data/` and
  renames it over the real file, so a crash mid-write can never corrupt it.
- Concurrent appends (e.g. two people uploading at once) are **serialized**
  through an in-memory queue in `src/workbookStore.ts`, so simultaneous
  requests can't race each other and silently drop a row. This is
  sufficient for a single Node process; scaling to multiple server
  processes/machines would need a real file lock or a database instead.

## Filename validation (web upload)

Server-side (`src/filenameValidator.ts`, always enforced) and mirrored
client-side for instant feedback:

- Must end in `.docx` exactly (legacy `.doc` is rejected with a clear
  message).
- Base name may only contain letters, numbers, spaces, and `( ) _ - .`
- No path separators, no `..`, no `< > : " | ? *`, no control characters.
- No Windows-reserved device names (`CON`, `PRN`, `COM1`, etc.).
- Max 150 characters.

A bad name is **rejected**, never silently renamed — the person re-uploads
with a corrected name. Content is validated separately (a `.txt` renamed to
`.docx` is still rejected, with its own error).

Note: Multer already reduces the incoming filename to its basename before
the app sees it, so a value like `../../etc/report.docx` arrives as
`report.docx` — directory-traversal attempts never reach the app logic.
The validator's own `..` check still matters for a literal `..` with no
slashes (e.g. `report..docx`), which Multer does not strip.

## Extracted fields

Column A is always the source filename; every field below gets its own
column, in this fixed order (51 columns total). Two fields — **Winning
Trades** and **Losing Trades** — are section headers in the source report
rather than data points, so they're always blank.

| Column | Field |
|--------|-------|
| A | Source File |
| B | Total Net Profit |
| C | Total Trades |
| D | Average Trade |
| E | Max Closed-out Drawdown |
| F | Max Intra-trade Drawdown |
| G | Account Size Required |
| H | Open Equity |
| I | Percent in the Market |
| J | Avg # of Bars in Trade |
| K | Avg # of Trades per Year |
| L | Monthly Profit Analysis |
| M | Average Monthly Profit |
| N | Std Dev of Monthly Profits |
| O | Winning Trades |
| P | Total Winners |
| Q | Gross Profit |
| R | Average Win |
| S | Largest Win |
| T | Largest Drawdown in Win |
| U | Avg Drawdown in Win |
| V | Avg Run Up in Win |
| W | Avg Run Down in Win |
| X | Most Consec Wins |
| Y | Avg # of Consec Wins |
| Z | Avg # of Bars in Wins |
| AA | Profit Factor ($Wins/$Losses) |
| AB | Winning Percentage |
| AC | Payout Ratio (AvgWin/AvgLoss) |
| AD | CPC Index (PF x Win% x PR) |
| AE | Expectancy (AvgTrade/AvgLoss) |
| AF | Return Pct |
| AG | Kelly Pct (AvgTrade/AvgWin) |
| AH | Optimal f |
| AI | Z-Score (W/L Predictability) |
| AJ | Current Streak |
| AK | Monthly Sharpe Ratio |
| AL | Annualized Sharpe Ratio |
| AM | Calmar Ratio |
| AN | Losing Trades |
| AO | Total Losers |
| AP | Gross Loss |
| AQ | Average Loss |
| AR | Largest Loss |
| AS | Largest Peak in Loss |
| AT | Avg Peak in Loss |
| AU | Avg Run Up in Loss |
| AV | Avg Run Down in Loss |
| AW | Most Consec Losses |
| AX | Avg # of Consec Losses |
| AY | Avg # of Bars in Losses |

## Project layout

```
src/
  fields.ts             Canonical field list, header text, label aliases
  docxExtractor.ts       Reads a .docx buffer/file, returns extracted values
  valueParser.ts          "$969,421" / "29.7%" / "144.6" -> typed value
  excelExporter.ts        Row-building + formatting helpers, one-shot export
  workbookStore.ts        Opens/creates/appends to the shared data/ workbook
  filenameValidator.ts    Upload filename validation rules
  server.ts               Express web server (upload page + API)
  index.ts                CLI entry point
public/
  index.html              Upload page (drag-and-drop, client-side validation)
data/
  strategy-reports.xlsx   The shared workbook (generated, gitignored)
```

## Setup

```bash
npm install
npm run build
```

## Usage — Web

```bash
npm run serve          # or: npm run dev:serve  (runs via ts-node, no build step)
```

Open `http://localhost:3000`, drag in a `.docx` report. On success it
downloads the updated `strategy-reports.xlsx` and shows which row was just
added. A "Download workbook" link at the top fetches the current file
anytime without uploading anything (`GET /api/download`).

`PORT` env var overrides the default port (3000).

## Usage — CLI

```bash
# Append one or more reports to the shared workbook (data/strategy-reports.xlsx)
node dist/index.js report1.docx report2.docx

# Point it at a whole directory of .docx files
node dist/index.js ./reports/

# Write a standalone file instead of touching the shared workbook
node dist/index.js report1.docx --out one-off-export.xlsx

# Exit non-zero if any file is missing a required field
node dist/index.js report1.docx --strict
```

## Error handling

- Invalid zip / non-`.docx` file, missing `word/document.xml`, or malformed
  XML → clear error, doesn't crash a batch (CLI continues with remaining
  files; web returns 400 with a reason).
- Missing individual fields → row is still written, with those cells set to
  `MISSING` and shown in red for easy review; `--strict` (CLI) turns this
  into a non-zero exit code instead.
- File size cap on upload: 20 MB.

## Requirements

- Node.js (tested on v22)
- npm