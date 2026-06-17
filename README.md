# RobApp.UI

A WPF desktop application (.NET 10) that automates the extraction of trading robot performance data from Word reports and consolidates it into an Excel spreadsheet.

## What it does

1. **Select a Word report** (`.docx`) — a trading strategy performance report containing fields such as Name, Symbols, Total Net Profit, Total Trades, Winning Percentage, Gross Profit/Loss, Average Trade, Max Closed-Out Drawdown, Open Equity, and Avg Trades per Year.
2. **Select an Excel workbook** (`.xlsx`) — the destination spreadsheet where results are stored.
3. **Process** — the app parses the Word document using regex patterns to extract each performance field, then writes (or updates) a row in the Excel file keyed by the report's filename.

## Key features

- Regex-based extraction from `.docx` files using `DocumentFormat.OpenXml`
- Excel read/write via `ClosedXML`; existing rows are updated in place, new reports are appended
- MVVM architecture using `CommunityToolkit.Mvvm`
- File validation (existence, extension, safe filename characters) before processing
- Live log output in the UI showing extraction progress and any errors

## Tech stack

| Package | Purpose |
|---|---|
| `CommunityToolkit.Mvvm` | MVVM helpers (ObservableObject, RelayCommand) |
| `ClosedXML` | Excel read/write |
| `DocumentFormat.OpenXml` | Word document parsing |
| `Xceed.Words.NET` | Word document support |

## Extracted fields

| Column | Field |
|---|---|
| A | FileName |
| B | ReportDate |
| C | Name |
| D | Symbols |
| E | TotalNetProfit |
| F | TotalTrades |
| G | WinningPercentage |
| H | TotalWinners |
| I | TotalLosers |
| J | GrossProfit |
| K | GrossLoss |
| L | AverageTrade |
| M | MaxClosedOutDrawdown |
| N | OpenEquity |
| O | AvgTradesPerYear |

## Running the tests

The integration tests live in `RobApp.UI.Tests/` and run cross-platform (no Windows required).

```bash
# From the repo root
dotnet test RobApp.UI.Tests/RobApp.UI.Tests.csproj
```

Expected output:
```
Test summary: total: 5, failed: 0, succeeded: 5, skipped: 0, duration: ~1s
```

### What the tests cover

| Test | Description |
|---|---|
| `ExtractFields_FromRealDocx_ReturnsAllExpectedValues` | Creates a real `.docx`, runs `WordService`, asserts all 14 fields are extracted correctly |
| `ExtractFields_MissingFile_ReturnsEmptyValues` | Service returns empty strings gracefully when the file doesn't exist |
| `WriteFieldsToExcel_NewRow_AppendsDataAtFirstAvailableRow` | Creates a real `.xlsx`, writes a row, verifies all 15 columns |
| `WriteFieldsToExcel_ExistingFileName_UpdatesRowInPlace` | Writing the same filename twice updates the row, no duplicate appended |
| `FullPipeline_WordToExcel_ProducesCorrectSpreadsheet` | End-to-end: `.docx` → `WordService` → `ExcelService` → asserts values in the spreadsheet |

> All tests create and delete temporary files automatically; no test fixtures need to be set up manually.

## Requirements

- Windows (WPF app)
- .NET 10 SDK
