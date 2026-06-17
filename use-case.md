# Use Case: Extracting Data from a Word Report

## Overview

The user selects a `.docx` trading robot performance report and a target `.xlsx` spreadsheet.
The app reads every line of the Word document, searches for known labels using pattern matching,
extracts the value next to each label, and writes one row into the spreadsheet.

---

## Step-by-step extraction algorithm

### Step 1 — Open the Word document

The app opens the `.docx` file and reads all its text, paragraph by paragraph and table cell by cell, into one continuous block of plain text. Line breaks are preserved. Special whitespace characters (non-breaking spaces, tabs) are normalized to regular spaces before any searching begins.

**What can go wrong:** If the file is corrupted or password-protected, the app logs an error and returns all fields as empty. No row is written to Excel.

---

### Step 2 — Extract: Report Date

**What it looks for:** A date/time stamp anywhere in the document that matches the format `M/D/YYYY H:MM AM/PM`.

**Examples that match:**
- `6/17/2026 10:00 AM`
- `12/1/2025 9:45`

**Examples that do NOT match:**
- `2026-06-17` (wrong format — dashes instead of slashes)
- `June 17, 2026` (written-out month)

**What is captured:** The full date and time string.

---

### Step 3 — Extract: Name

**What it looks for:** A line containing the word `Name` followed by a colon `:` or dash `-`, then captures everything after it on the same line.

**Examples that match:**
- `Name: MyRobotStrategy`
- `Name - AlgoBot_v2`
- `name: test robot` (case-insensitive)

**Examples that do NOT match:**
- `Strategy Name` (label comes after, not before, the value)
- `NameMyRobotStrategy` (no separator)

**What is captured:** The text after the separator, e.g. `MyRobotStrategy`.

---

### Step 4 — Extract: Symbols

**What it looks for:** A line containing the word `Symbols` followed by `:` or `-`, then captures everything after it on the same line.

**Examples that match:**
- `Symbols: EURUSD`
- `Symbols: EURUSD, GBPUSD`

**Examples that do NOT match:**
- `Symbol: EURUSD` (singular — missing the `s`)

**What is captured:** The text after the separator, e.g. `EURUSD`.

---

### Step 5 — Extract: Total Net Profit

**What it looks for:** The phrase `Total Net Profit` (allows extra spaces between words) followed by `:` or `-`, then an optional `$` sign, then a numeric value. Only digits, commas, dots, and a leading minus sign are captured.

**Examples that match:**
- `Total Net Profit: 12,345.67`
- `Total Net Profit : -500.00`
- `Total  Net  Profit: $9,999`

**Examples that do NOT match:**
- `Net Profit: 500` (missing the word `Total`)
- `Total Net Profit: N/A` (non-numeric value)

**What is captured:** The numeric part only, e.g. `12,345.67`.

---

### Step 6 — Extract: Total Trades

**What it looks for:** The phrase `Total Trades` followed by `:` or `-`, then a whole number (integers only, no decimals).

**Examples that match:**
- `Total Trades: 200`
- `Total Trades - 45`

**Examples that do NOT match:**
- `Total Trades: 200.5` (decimal not captured — stops at `200`)
- `Trades: 200` (missing the word `Total`)

**What is captured:** The integer, e.g. `200`.

---

### Step 7 — Extract: Winning Percentage

**What it looks for:** The phrase `Winning Percentage` followed by `:` or `-`, then a numeric value that may include a `%` sign.

**Examples that match:**
- `Winning Percentage: 65.5%`
- `Winning Percentage - 70`

**Examples that do NOT match:**
- `Win Percentage: 65%` (abbreviated label)

**What is captured:** The value including `%` if present, e.g. `65.5%`.

---

### Step 8 — Extract: Total Winners

**What it looks for:** The phrase `Total Winners` followed by `:` or `-`, then a whole number.

**Examples that match:**
- `Total Winners: 130`
- `Total Winners - 88`

**What is captured:** The integer, e.g. `130`.

---

### Step 9 — Extract: Total Losers

**What it looks for:** The phrase `Total Losers` followed by `:` or `-`, then a whole number.

**Examples that match:**
- `Total Losers: 70`

**What is captured:** The integer, e.g. `70`.

---

### Step 10 — Extract: Gross Profit

**What it looks for:** The phrase `Gross Profit` followed by `:` or `-`, then a numeric value (may be negative).

**Examples that match:**
- `Gross Profit: 20,000.00`
- `Gross Profit - -500`

**What is captured:** The numeric value, e.g. `20,000.00`.

> **Important:** The pattern for Gross Profit will also match a line that contains `Gross Profit` even if it appears inside a longer label like `Total Gross Profit`. If the document contains such a line, the first match wins.

---

### Step 11 — Extract: Gross Loss

**What it looks for:** The phrase `Gross Loss` followed by `:` or `-`, then a numeric value (typically negative).

**Examples that match:**
- `Gross Loss: -7,654.33`

**What is captured:** The numeric value, e.g. `-7,654.33`.

---

### Step 12 — Extract: Average Trade

**What it looks for:** The phrase `Average Trade` followed by `:` or `-`, then a numeric value (may be negative).

**Examples that match:**
- `Average Trade: 123.45`
- `Average Trade - -10.00`

**What is captured:** The numeric value, e.g. `123.45`.

---

### Step 13 — Extract: Max Closed-Out Drawdown

**What it looks for:** The phrase `Max Closed-out Drawdown` or `Max Closed out Drawdown` (hyphen or space between `Closed` and `out`) followed by `:` or `-`, then a numeric value.

**Examples that match:**
- `Max Closed-out Drawdown: -2,000.00`
- `Max Closed out Drawdown : -500`

**Examples that do NOT match:**
- `Max Drawdown: -2000` (shortened label)
- `Maximum Closed-out Drawdown: -2000` (different prefix)

**What is captured:** The numeric value, e.g. `-2,000.00`.

---

### Step 14 — Extract: Open Equity

**What it looks for:** The phrase `Open Equity` followed by `:` or `-`, then a numeric value.

**Examples that match:**
- `Open Equity: 50,000.00`

**What is captured:** The numeric value, e.g. `50,000.00`.

---

### Step 15 — Extract: Avg Trades per Year

**What it looks for:** The phrase `Avg # of Trades per Year` (allows extra spaces around `#`) followed by `:` or `-`, then a numeric value.

**Examples that match:**
- `Avg # of Trades per Year: 25.0`
- `Avg # of Trades per Year - 12`

**Examples that do NOT match:**
- `Average # of Trades per Year: 25` (uses `Average` instead of `Avg`)
- `Avg Trades per Year: 25` (missing `# of`)

**What is captured:** The numeric value, e.g. `25.0`.

---

## Step 16 — Write to Excel

Once all fields are extracted, the app opens the target `.xlsx` file and:

1. Scans column A (FileName) starting from row 2 to check if a row for this report already exists.
2. **If found** — overwrites that row with the new values (update in place).
3. **If not found** — appends a new row at the bottom.

The row is written in this column order:

| Column | Field              |
|--------|--------------------|
| A      | FileName           |
| B      | ReportDate         |
| C      | Name               |
| D      | Symbols            |
| E      | TotalNetProfit     |
| F      | TotalTrades        |
| G      | WinningPercentage  |
| H      | TotalWinners       |
| I      | TotalLosers        |
| J      | GrossProfit        |
| K      | GrossLoss          |
| L      | AverageTrade       |
| M      | MaxClosedOutDrawdown |
| N      | OpenEquity         |
| O      | AvgTradesPerYear   |

If a field was not found in the Word document, its cell is left **empty** (no error is thrown).

---

## What the product owner should verify

- [ ] The report date format matches `M/D/YYYY H:MM AM/PM` — if your reports use a different format, the date will not be captured.
- [ ] Every label in the Word report (`Name:`, `Symbols:`, `Total Net Profit:`, etc.) uses a colon `:` or dash `-` as the separator. Other separators (e.g. `=`, tab, just a space) will not be recognised.
- [ ] `Avg # of Trades per Year` must appear exactly with that wording — abbreviated or reworded labels will not match.
- [ ] `Max Closed-out Drawdown` must use either a hyphen or a space between `Closed` and `out`.
- [ ] Numeric values must use digits, commas, and dots only (e.g. `12,345.67`). Currency symbols other than `$` before the number will cause the value to not be captured.
- [ ] The Excel file must already have a header row in row 1 — the app starts writing data from row 2.
