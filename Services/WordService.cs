using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Xceed.Words.NET;
namespace RobApp.UI.Services
{
 public class WordService
 {
 // Regex patterns for the fields based on your example
 private readonly Dictionary<string, string> _patterns = new()
 {
     { "ReportDate", @"(\d{1,2}/\d{1,2}/\d{4}\s*\d{1,2}:\d{2}\s*(AM|PM)?)" },
     { "Name", @"(?i)Name\s*[:-]\s*(.+)" },
     { "Symbols", @"(?i)Symbols\s*[:-]\s*(.+)" },
     { "TotalNetProfit", @"(?i)Total\sNet\sProfit\s*[:-]\s*([-0-9.,]+)" },
     { "TotalTrades", @"(?i)Total\sTrades\s[:-]\s*([0-9]+)" },
     { "WinningPercentage", @"(?i)Winning\sPercentage\s[:-]\s*([0-9.,%]+)" },
     { "TotalWinners", @"(?i)Total\sWinners\s[:-]\s*([0-9]+)" },
     { "TotalLosers", @"(?i)Total\sLosers\s[:-]\s*([0-9]+)" },
     { "GrossProfit", @"(?i)Gross\sProfit\s[:-]\s*([-0-9.,]+)" },
     { "GrossLoss", @"(?i)Gross\sLoss\s[:-]\s*([-0-9.,]+)" },
     { "AverageTrade", @"(?i)Average\sTrade\s[:-]\s*([-0-9.,]+)" },
     { "MaxClosedOutDrawdown", @"(?i)Max\sClosed[-\s]out\sDrawdown\s[:-]\s*([-0-9.,]+)" },
     { "OpenEquity", @"(?i)Open\sEquity\s[:-]\s*([-0-9.,]+)" },
     { "AvgTradesPerYear", @"(?i)Avg\s*#\sof\sTrades\sper\sYear\s*[:-]\s*([0-9.,]+)" }
 };

 public Dictionary<string, string> ExtractFields(string docxPath)
 {
     var result = new Dictionary<string, string>();
     var doc = DocX.Load(docxPath);
     var text = doc.Text.Replace("\r\n", "\n");

     foreach (var kv in _patterns)
     {
         var m = Regex.Match(text, kv.Value, RegexOptions.Multiline);
         if (m.Success)
             result[kv.Key] = m.Groups[1].Value.Trim();
         else
             result[kv.Key] = ""; // vacío si no encuentra
     }

     return result;
 }
 }


}
