using ClosedXML.Excel;
using System;
using System.Collections.Generic;
namespace RobApp.UI.Services
{
 public class ExcelService
 {
 // Column mapping according to your requested order:
 // A: FileName, B: ReportDate, C: Name, D: Symbols, E: TotalNetProfit,
 // F: TotalTrades, G: WinningPercentage, H: TotalWinners, I: TotalLosers,
 // J: GrossProfit, K: GrossLoss, L: AverageTrade, M: MaxClosedOutDrawdown,
 // N: OpenEquity, O: AvgTradesPerYear

 private readonly Dictionary<string, int> _colMap = new()
 {
     { "FileName", 1 },
     { "ReportDate", 2 },
     { "Name", 3 },
     { "Symbols", 4 },
     { "TotalNetProfit", 5 },
     { "TotalTrades", 6 },
     { "WinningPercentage", 7 },
     { "TotalWinners", 8 },
     { "TotalLosers", 9 },
     { "GrossProfit", 10 },
     { "GrossLoss", 11 },
     { "AverageTrade", 12 },
     { "MaxClosedOutDrawdown", 13 },
     { "OpenEquity", 14 },
     { "AvgTradesPerYear", 15 }
 };

 public void WriteFieldsToExcel(string excelPath, string fileName, Dictionary<string, string> fields)
 {
     using var wb = new XLWorkbook(excelPath);
     var ws = wb.Worksheet(1);

     // Find existing row by FileName (col A) or append
     var lastUsed = ws.LastRowUsed();
     int firstDataRow = 2; // assume row 1 has headers
     int foundRow = -1;
     if (lastUsed != null)
     {
         var rows = ws.Range(firstDataRow, 1, lastUsed.RowNumber(), 1).CellsUsed();
         foreach (var cell in rows)
         {
             if (cell.GetString().Equals(fileName, StringComparison.OrdinalIgnoreCase))
             {
                 foundRow = cell.Address.RowNumber;
                 break;
             }
         }
     }

     int targetRow = foundRow > 0 ? foundRow : ((lastUsed?.RowNumber() ?? 1) + 1);

     // Write FileName
     ws.Cell(targetRow, _colMap["FileName"]).Value = fileName;

     // Write mapped fields if present
     foreach (var kv in _colMap)
     {
         if (kv.Key == "FileName") continue;
         fields.TryGetValue(kv.Key, out var value);
         ws.Cell(targetRow, kv.Value).Value = value ?? "";
     }

     wb.Save();
 }
 }


}
