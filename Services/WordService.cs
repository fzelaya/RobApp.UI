
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

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
            //{ "TotalNetProfit", @"(?i)Total\sNet\sProfit\s*[:-]\s*([-0-9.,]+)" },
            { "TotalNetProfit", @"(?i)Total\s+Net\s+Profit\s*[:-]\s*$?\s*([0-9.,-]+)(?=\s|$)" },
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

        string text;
        try
        {
            text = ReadAllTextFromDocx(docxPath);
        }
        catch (Exception ex)
        {
            // If file can't be read, return empty values
            foreach (var key in _patterns.Keys)
                result[key] = "";
            return result;
        }

            // Normalize newlines
            //text = text.Replace("\r\n", "\n").Replace("\r", "\n");
            text = text.Replace('\u00A0', ' ').Replace('\t', ' ');

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

    private static string ReadAllTextFromDocx(string filePath)
    {
        var sb = new StringBuilder();

        using (var wordDoc = WordprocessingDocument.Open(filePath, false))
        {
            var mainPart = wordDoc.MainDocumentPart;
            if (mainPart?.Document?.Body == null)
                return string.Empty;

            // Extract paragraphs and runs preserving basic spacing/newlines
            foreach (var element in mainPart.Document.Body.Elements())
            {
                AppendElementText(element, sb);
            }
        }

        return sb.ToString();
    }

    private static void AppendElementText(OpenXmlElement element, StringBuilder sb)
    {
        // If paragraph, append its text and a newline
        if (element is Paragraph para)
        {
            var paraText = string.Concat(para.Descendants<Text>().Select(t => t.Text));
            sb.Append(paraText);
            sb.Append("\n");
            return;
        }

        // If table, include cell texts with newlines between cells/rows
        if (element is Table table)
        {
            foreach (var row in table.Elements<TableRow>())
            {
                var firstCell = true;
                foreach (var cell in row.Elements<TableCell>())
                {
                    if (!firstCell) sb.Append("\t");
                    var cellText = string.Concat(cell.Descendants<Text>().Select(t => t.Text));
                    sb.Append(cellText);
                    firstCell = false;
                }
                sb.Append("\n");
            }
            return;
        }

        // Fallback: recurse into children
        foreach (var child in element.Elements())
            AppendElementText(child, sb);
    }
}


}
