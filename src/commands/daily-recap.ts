import { resolve } from "path";
import {
  loadAnalytics,
  type AnalyticsData,
} from "../lib/analytics-store.ts";
import type { PeriodData } from "../lib/types.ts";

export interface DailyRecapOptions {
  target?: string;
}

function getTodayViews(analytics: AnalyticsData): number {
  const today = new Date().toISOString().split("T")[0]!;
  const entry = analytics.dailyViews.find((dv) => dv.date === today);
  return entry?.count ?? 0;
}

function getTodayClicks(analytics: AnalyticsData): number {
  const today = new Date().toISOString().split("T")[0]!;
  return analytics.clicks.filter((c) => c.timestamp.startsWith(today)).length;
}

function formatRecap(
  todayViews: number,
  todayClicks: number,
  activeBids: number,
  highestBid: number | null,
  totalViews: number,
  totalClicks: number,
): string {
  const lines: string[] = [];
  lines.push("=== BidMe: Daily Recap ===");
  lines.push("");
  lines.push(`📊 Today's Stats`);
  lines.push(`  Views:  ${todayViews}`);
  lines.push(`  Clicks: ${todayClicks}`);
  lines.push("");
  lines.push(`📈 All-Time Totals`);
  lines.push(`  Views:  ${totalViews}`);
  lines.push(`  Clicks: ${totalClicks}`);
  lines.push("");
  lines.push(`🏷️  Active Bids: ${activeBids}`);
  if (highestBid !== null) {
    lines.push(`💰 Highest Bid:  $${highestBid}`);
  } else {
    lines.push(`💰 Highest Bid:  —`);
  }
  lines.push("");
  lines.push("=== End Daily Recap ===");
  // TODO: Future: send this via GitHub Actions email or integrate with email service
  return lines.join("\n");
}

export async function runDailyRecap(
  options: DailyRecapOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();

  const analyticsPath = resolve(target, ".bidme/data/analytics.json");
  const analytics = await loadAnalytics(analyticsPath);

  const todayViews = getTodayViews(analytics);
  const todayClicks = getTodayClicks(analytics);

  let activeBids = 0;
  let highestBid: number | null = null;

  const periodPath = resolve(target, ".bidme/data/current-period.json");
  const periodFile = Bun.file(periodPath);
  if (await periodFile.exists()) {
    try {
      const periodData: PeriodData = JSON.parse(await periodFile.text());
      if (periodData.status === "open") {
        const approved = periodData.bids.filter(
          (b) => b.status === "approved" || b.status === "pending",
        );
        activeBids = approved.length;
        if (approved.length > 0) {
          highestBid = Math.max(...approved.map((b) => b.amount));
        }
      }
    } catch {
      // Period data unavailable — continue without bid info
    }
  }

  const recap = formatRecap(
    todayViews,
    todayClicks,
    activeBids,
    highestBid,
    analytics.totalViews,
    analytics.clicks.length,
  );

  console.log(recap);

  return { success: true, message: "Daily recap generated" };
}

export { getTodayViews, getTodayClicks, formatRecap };
