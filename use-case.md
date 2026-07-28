# Use Case: Extracting Data from a Word Report

## Overview

The user uploads a `.docx` trading strategy performance report — either
through the web upload page or the CLI. The app opens the file, locates
every table in the document, builds a map of every `Label: Value` pair it
finds (regardless of how Word has internally formatted that cell), matches
50 known metric labels against that map, and appends one row to a single
shared spreadsheet, `data/strategy-reports.xlsx`.

This replaces an earlier draft of this use case, which assumed the app
would scan the document as flat paragraph text and match each field with
its own hand-written regex. That approach doesn't hold up against the
report format actually being used (see Step 1) — the implemented app
instead parses the document's table structure directly and uses one
generic label-matching mechanism for all fields, driven by a field list
rather than per-field code. The differences that matter for product
sign-off are called out inline below and summarized in the checklist at
the end.

---

## Step-by-step extraction algorithm

### Step 1 — Validate the filename (web upload only)

Before anything in the file is read, the uploaded filename itself is
checked:

- Must end in `.docx` exactly (legacy `.doc` is rejected with a clear
  message telling the user to re-save as `.docx`).
- May only contain letters, numbers, spaces, and `( ) _ - .`
- No path separators, no `..`, no `< > : " | ? *`, no control characters,
  no Windows-reserved device names (`CON`, `PRN`, `COM1`, etc.), and no
  more than 150 characters.

A bad filename is **rejected outright** with a specific reason — it is
never silently renamed or truncated. The person re-uploads with a
corrected name. (The CLI skips this step, since it's handed a filesystem
path directly rather than an untrusted upload.)

---

### Step 2 — Open the Word document

The `.docx` file is a zip archive. The app:

1. Confirms the file starts with the zip signature (`PK`) before doing
   anything else — this alone catches most "wrong file type" mistakes
   immediately, with a message distinguishing "not a zip file" from
   "a zip file, but not a Word document" (missing `word/document.xml`).
2. Unzips it and parses `word/document.xml` as XML.

**What's different from a plain-text reader, and why it matters:** the
performance reports this app targets (TradeStation/MultiCharts-style
"Strategy Performance Report" exports) place several of their value cells
inside Word content controls (`<w:sdt>` — Structured Document Tags). That
wrapping nests the value cell one level deeper than a normal table cell,
which silently breaks any approach that reads "the text of each cell in
this row" using only direct children — including a plain paragraph-by-
paragraph text dump. Those cells just come back blank, with no error to
signal that anything was missed.

To avoid that, the app searches for `w:tc` (table cell) elements as
**descendants** of each table row rather than direct children, which finds
the cell correctly whether or not it's wrapped in a content control.

**What can go wrong:** a corrupted file, a non-zip file, a zip file that
isn't actually a Word document, or malformed XML inside it all produce a
specific error message and stop processing — no row is written for that
file. Other files in the same batch (CLI) or other uploads (web) are
unaffected.

---

### Step 3 — Build the label → value map

Rather than a separate regex per field, the app walks every table in the
document once and builds a single map: for each row, it reads every cell's
text in document order, and whenever a cell's trimmed text ends in a colon
(`:`), it records that label with the text of the **immediately following
cell** as its value. This mirrors how the source reports are actually laid
out — labels and values are always adjacent cells, including rows that
pack two label/value pairs side by side (a label/value pair, a blank
spacer cell, then a second label/value pair).

This is a **table-cell-based** extraction, not a free-text scan. A label
and its value need to be in adjacent cells of the same row; a label found
in a plain paragraph (outside any table) is not matched. All 50 fields the
app looks for happen to live in one table in the source reports.

---

### Step 4 — Match each known field

The app has a fixed list of 50 canonical fields (see the full table
below). Each one is matched against the label map using:

- Case-insensitive comparison.
- A trailing colon stripped from the label before comparing.
- Non-breaking spaces normalized to regular spaces, and repeated
  whitespace collapsed.
- A short list of known wording variants per field where the source
  reports are inconsistent — e.g. both `Max Closed-out Drawdown` and
  `Max Closed-Out Drawdown` are accepted as the same field.

Two entries — **Monthly Profit Analysis**, **Winning Trades**, and
**Losing Trades** — are section headers in the source report, not data
points with a value next to them. They're marked optional and are always
left blank; this does not count as a missing field.

**Not currently extracted:** an earlier draft of this use case (and an
earlier mockup) listed `ReportDate`, `Name`, and `Symbols` as fields.
These are **not** in the implemented field list — the app does not
currently extract them. If the product needs them, they'd be added the
same way as any other field (label + aliases in `src/fields.ts`); flagging
this here so it's a deliberate decision rather than a silent gap.

---

### Step 5 — The 50 extracted fields

| Total Net Profit | Total Trades | Average Trade | Max Closed-out Drawdown | Max Intra-trade Drawdown |
|---|---|---|---|---|
| Account Size Required | Open Equity | Percent in the Market | Avg # of Bars in Trade | Avg # of Trades per Year |
| Monthly Profit Analysis * | Average Monthly Profit | Std Dev of Monthly Profits | Winning Trades * | Total Winners |
| Gross Profit | Average Win | Largest Win | Largest Drawdown in Win | Avg Drawdown in Win |
| Avg Run Up in Win | Avg Run Down in Win | Most Consec Wins | Avg # of Consec Wins | Avg # of Bars in Wins |
| Profit Factor ($Wins/$Losses) | Winning Percentage | Payout Ratio (AvgWin/AvgLoss) | CPC Index (PF x Win% x PR) | Expectancy (AvgTrade/AvgLoss) |
| Return Pct | Kelly Pct (AvgTrade/AvgWin) | Optimal f | Z-Score (W/L Predictability) | Current Streak |
| Monthly Sharpe Ratio | Annualized Sharpe Ratio | Calmar Ratio | Losing Trades * | Total Losers |
| Gross Loss | Average Loss | Largest Loss | Largest Peak in Loss | Avg Peak in Loss |
| Avg Run Up in Loss | Avg Run Down in Loss | Most Consec Losses | Avg # of Consec Losses | Avg # of Bars in Losses |

\* Section header in the source report — always blank, not treated as missing.

The exact spreadsheet column each of these maps to is in Step 7.

---

### Step 6 — Convert each value to a typed cell

Raw extracted text is a string (e.g. `$969,421`, `-29.7%`, `144.6`,
`N/A for baskets`, `7 Losses`). Before writing to Excel, each value is
classified and converted so the spreadsheet has real numbers to sort,
filter, and chart on rather than text everywhere:

| Raw text looks like | Written as | Cell format |
|---|---|---|
| `$969,421` / `-$113,732` | Number | Currency, negatives in red |
| `29.7%` / `-6.7%` | Number (fraction) | Percent, one decimal |
| `144.6` / `2,453` | Number | `#,##0.00` |
| Anything else (`N/A for baskets`, `7 Losses`) | Text, unchanged | — |

A field with no value at all (not found, and not one of the optional
section headers) is written as the literal text `MISSING`, and that cell's
font is colored red so it's visible at a glance on review — the row is
still written; extraction of one field never blocks the rest.

---

### Step 7 — Write to the shared Excel workbook

Unlike the earlier draft of this use case, the app does **not** target a
spreadsheet the user picks per run. There is **one fixed file**,
`data/strategy-reports.xlsx`, that every extraction — from any upload,
from any run of the CLI — writes into. It's created automatically (with
just a header row) the first time the app runs if it doesn't already
exist.

**Write behavior — important difference from the earlier draft:** the
current implementation always **appends** a new row. It does **not** scan
column A for an existing filename and overwrite that row the way the
previous draft specified. Re-uploading the same report twice produces two
rows, not one updated row. This is a deliberate simplification for now,
called out explicitly in the checklist below for product sign-off, since
the previous draft's behavior was different on this exact point.

Writes are atomic (written to a temp file, then renamed over the real
file, so a crash mid-write can't corrupt it) and serialized so that two
uploads happening at the same time can't race each other and drop a row.

**Column layout** — column A is always the source filename; the 50 fields
follow in a fixed order:

| Column | Field | | Column | Field |
|---|---|---|---|---|
| A | Source File | | AA | Profit Factor ($Wins/$Losses) |
| B | Total Net Profit | | AB | Winning Percentage |
| C | Total Trades | | AC | Payout Ratio (AvgWin/AvgLoss) |
| D | Average Trade | | AD | CPC Index (PF x Win% x PR) |
| E | Max Closed-out Drawdown | | AE | Expectancy (AvgTrade/AvgLoss) |
| F | Max Intra-trade Drawdown | | AF | Return Pct |
| G | Account Size Required | | AG | Kelly Pct (AvgTrade/AvgWin) |
| H | Open Equity | | AH | Optimal f |
| I | Percent in the Market | | AI | Z-Score (W/L Predictability) |
| J | Avg # of Bars in Trade | | AJ | Current Streak |
| K | Avg # of Trades per Year | | AK | Monthly Sharpe Ratio |
| L | Monthly Profit Analysis | | AL | Annualized Sharpe Ratio |
| M | Average Monthly Profit | | AM | Calmar Ratio |
| N | Std Dev of Monthly Profits | | AN | Losing Trades |
| O | Winning Trades | | AO | Total Losers |
| P | Total Winners | | AP | Gross Loss |
| Q | Gross Profit | | AQ | Average Loss |
| R | Average Win | | AR | Largest Loss |
| S | Largest Win | | AS | Largest Peak in Loss |
| T | Largest Drawdown in Win | | AT | Avg Peak in Loss |
| U | Avg Drawdown in Win | | AU | Avg Run Up in Loss |
| V | Avg Run Up in Win | | AV | Avg Run Down in Loss |
| W | Avg Run Down in Win | | AW | Most Consec Losses |
| X | Most Consec Wins | | AX | Avg # of Consec Losses |
| Y | Avg # of Consec Wins | | AY | Avg # of Bars in Losses |
| Z | Avg # of Bars in Wins | | | |

---

## What the product owner should verify

- [ ] **Append vs. overwrite:** confirm append-only (one row per upload,
  even for a repeat of the same report) is the intended behavior. The
  earlier draft specified overwrite-by-filename; the implemented app does
  not do this yet.
- [ ] **ReportDate / Name / Symbols:** confirm whether these fields (present
  in an earlier draft and mockup) are actually needed. They are not
  currently extracted.
- [ ] Extraction only looks at **table cells**, not paragraph text outside
  a table. Confirm all source reports keep their metrics in a table (true
  for the sample report reviewed during development).
- [ ] Label matching tolerates case, extra whitespace, and a short list of
  known wording variants per field — but a genuinely different label
  (e.g. an abbreviated or reworded metric name not already in the alias
  list) will not match, and that field will be written as `MISSING`.
- [ ] A missing field no longer causes a blank cell silently — it's
  written as the text `MISSING` and highlighted red, so gaps are visible
  on review rather than indistinguishable from "value was empty".
- [ ] Filename validation (web upload) rejects non-`.docx` files and files
  with unsafe/disallowed characters in the name before any content is
  read — confirm the allowed character set (letters, numbers, spaces,
  `( ) _ - .`) is not too restrictive for how reports are actually named.
- [ ] File size cap on upload: 20 MB.
