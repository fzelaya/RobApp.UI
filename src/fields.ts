/**
 * Canonical list of fields to extract, in the exact order/spelling the
 * Excel output should use as column headers.
 *
 * `aliases` covers the label-text variations that show up across report
 * exports (curly vs. straight text, extra/missing spaces, "Closed-out" vs
 * "Closed-Out", "Winners" vs "Winning Trades", etc.). Matching is done on a
 * normalized form (lowercased, punctuation/whitespace collapsed), so most
 * of these aliases are just here for documentation / readability rather
 * than being strictly necessary -- but a couple (Total Winners vs Winning
 * Trades) really do refer to different labels in the source document.
 */

export interface FieldSpec {
  /** Exact header text to write into the Excel file. */
  header: string;
  /** Raw label text(s) as they may appear in the .docx, colon included or not. */
  aliases: string[];
  /** If true, it's OK for this field to have no value in the source doc
   *  (e.g. it's a section header rather than a labeled data point). */
  optional?: boolean;
}

export const FIELD_SPECS: FieldSpec[] = [
  { header: "Total Net Profit", aliases: ["Total Net Profit"] },
  { header: "Total Trades", aliases: ["Total Trades"] },
  { header: "Average Trade", aliases: ["Average Trade"] },
  { header: "Max Closed-out Drawdown", aliases: ["Max Closed-out Drawdown", "Max Closed-Out Drawdown"] },
  { header: "Max Intra-trade Drawdown", aliases: ["Max Intra-trade Drawdown", "Max Intra-Trade Drawdown"] },
  { header: "Account Size Required", aliases: ["Account Size Required"] },
  { header: "Open Equity", aliases: ["Open Equity"] },
  { header: "Percent in the Market", aliases: ["Percent in the Market"] },
  { header: "Avg # of Bars in Trade", aliases: ["Avg # of Bars in Trade", "Avg. # of Bars in Trade"] },
  { header: "Avg # of Trades per Year", aliases: ["Avg # of Trades per Year"] },

  // Section header only in most report exports -- no value cell follows it.
  { header: "Monthly Profit Analysis", aliases: ["Monthly Profit Analysis"], optional: true },
  { header: "Average Monthly Profit", aliases: ["Average Monthly Profit"] },
  { header: "Std Dev of Monthly Profits", aliases: ["Std Dev of Monthly Profits", "Std. Dev. of Monthly Profits"] },

  // Section header only -- see "Total Winners" below for the actual count.
  { header: "Winning Trades", aliases: ["Winning Trades"], optional: true },
  { header: "Total Winners", aliases: ["Total Winners"] },
  { header: "Gross Profit", aliases: ["Gross Profit"] },
  { header: "Average Win", aliases: ["Average Win"] },
  { header: "Largest Win", aliases: ["Largest Win"] },
  { header: "Largest Drawdown in Win", aliases: ["Largest Drawdown in Win"] },
  { header: "Avg Drawdown in Win", aliases: ["Avg Drawdown in Win"] },
  { header: "Avg Run Up in Win", aliases: ["Avg Run Up in Win"] },
  { header: "Avg Run Down in Win", aliases: ["Avg Run Down in Win"] },
  { header: "Most Consec Wins", aliases: ["Most Consec Wins"] },
  { header: "Avg # of Consec Wins", aliases: ["Avg # of Consec Wins"] },
  { header: "Avg # of Bars in Wins", aliases: ["Avg # of Bars in Wins"] },

  { header: "Profit Factor ($Wins/$Losses)", aliases: ["Profit Factor ($Wins/$Losses)", "Profit Factor"] },
  { header: "Winning Percentage", aliases: ["Winning Percentage"] },
  { header: "Payout Ratio (AvgWin/AvgLoss)", aliases: ["Payout Ratio (AvgWin/AvgLoss)", "Payout Ratio"] },
  { header: "CPC Index (PF x Win% x PR)", aliases: ["CPC Index (PF x Win% x PR)", "CPC Index"] },
  { header: "Expectancy (AvgTrade/AvgLoss)", aliases: ["Expectancy (AvgTrade/AvgLoss)", "Expectancy"] },
  { header: "Return Pct", aliases: ["Return Pct", "Return %"] },
  { header: "Kelly Pct (AvgTrade/AvgWin)", aliases: ["Kelly Pct (AvgTrade/AvgWin)", "Kelly %"] },
  { header: "Optimal f", aliases: ["Optimal f"] },
  { header: "Z-Score (W/L Predictability)", aliases: ["Z-Score (W/L Predictability)", "Z-Score"] },
  { header: "Current Streak", aliases: ["Current Streak"] },
  { header: "Monthly Sharpe Ratio", aliases: ["Monthly Sharpe Ratio"] },
  { header: "Annualized Sharpe Ratio", aliases: ["Annualized Sharpe Ratio"] },
  { header: "Calmar Ratio", aliases: ["Calmar Ratio"] },

  { header: "Losing Trades", aliases: ["Losing Trades"], optional: true },
  { header: "Total Losers", aliases: ["Total Losers"] },
  { header: "Gross Loss", aliases: ["Gross Loss"] },
  { header: "Average Loss", aliases: ["Average Loss"] },
  { header: "Largest Loss", aliases: ["Largest Loss"] },
  { header: "Largest Peak in Loss", aliases: ["Largest Peak in Loss"] },
  { header: "Avg Peak in Loss", aliases: ["Avg Peak in Loss"] },
  { header: "Avg Run Up in Loss", aliases: ["Avg Run Up in Loss"] },
  { header: "Avg Run Down in Loss", aliases: ["Avg Run Down in Loss"] },
  { header: "Most Consec Losses", aliases: ["Most Consec Losses"] },
  { header: "Avg # of Consec Losses", aliases: ["Avg # of Consec Losses"] },
  { header: "Avg # of Bars in Losses", aliases: ["Avg # of Bars in Losses"] },
];

/**
 * Normalizes a label for matching: lowercase, strip a trailing colon,
 * collapse whitespace (including non-breaking spaces), and drop a couple
 * of punctuation variants that show up across report generators.
 */
export function normalizeLabel(raw: string): string {
  return raw
    .replace(/\u00A0/g, " ")   // non-breaking space -> regular space
    .trim()
    .replace(/:\s*$/, "")      // trailing colon
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Build a lookup from normalized alias -> canonical header. */
export function buildAliasLookup(): Map<string, FieldSpec> {
  const map = new Map<string, FieldSpec>();
  for (const spec of FIELD_SPECS) {
    for (const alias of spec.aliases) {
      map.set(normalizeLabel(alias), spec);
    }
  }
  return map;
}
