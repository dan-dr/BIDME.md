import { resolve } from "path";
import { loadConfig } from "../lib/config.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import {
  loadAnalytics,
  saveAnalytics,
  recordClick,
  getClickThroughRate,
  type AnalyticsData,
  type DailyView,
  type PeriodAnalytics,
} from "../lib/analytics-store.ts";
import { logError } from "../lib/error-handler.ts";

export interface UpdateAnalyticsOptions {
  target?: string;
}

export interface PreviousWeekStats {
  views: number;
  clicks: number;
  ctr: number;
}

function mergeDailyViews(existing: DailyView[], incoming: DailyView[]): DailyView[] {
  const map = new Map<string, DailyView>();
  for (const dv of existing) {
    map.set(dv.date, dv);
  }
  for (const dv of incoming) {
    const prev = map.get(dv.date);
    if (prev) {
      map.set(dv.date, {
        date: dv.date,
        count: Math.max(prev.count, dv.count),
        uniques: Math.max(prev.uniques, dv.uniques),
      });
    } else {
      map.set(dv.date, dv);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function computePreviousWeekStats(data: AnalyticsData): PreviousWeekStats {
  const now = new Date();
  const endOfPreviousWeek = new Date(now);
  endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() - endOfPreviousWeek.getDay());
  endOfPreviousWeek.setHours(0, 0, 0, 0);

  const startOfPreviousWeek = new Date(endOfPreviousWeek);
  startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);

  const startStr = startOfPreviousWeek.toISOString().split("T")[0]!;
  const endStr = endOfPreviousWeek.toISOString().split("T")[0]!;

  const views = data.dailyViews
    .filter((dv) => dv.date >= startStr && dv.date < endStr)
    .reduce((sum, dv) => sum + dv.count, 0);

  const clicks = data.clicks.filter((c) => {
    const clickDate = c.timestamp.split("T")[0]!;
    return clickDate >= startStr && clickDate < endStr;
  }).length;

  const ctr = getClickThroughRate(views, clicks);

  return { views, clicks, ctr };
}

function computePeriodAggregates(data: AnalyticsData, periods: PeriodAnalytics[]): PeriodAnalytics[] {
  return periods.map((p) => {
    const startStr = p.start_date.split("T")[0]!;
    const endStr = p.end_date.split("T")[0]!;

    const views = data.dailyViews
      .filter((dv) => dv.date >= startStr && dv.date <= endStr)
      .reduce((sum, dv) => sum + dv.count, 0);

    const clicks = data.clicks.filter((c) => {
      const clickDate = c.timestamp.split("T")[0]!;
      return clickDate >= startStr && clickDate <= endStr;
    }).length;

    const ctr = getClickThroughRate(views, clicks);

    return { ...p, views, clicks, ctr };
  });
}

export async function runUpdateAnalytics(
  options: UpdateAnalyticsOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Updating Analytics ===\n");

  const analyticsPath = resolve(target, ".bidme/data/analytics.json");
  let analytics = await loadAnalytics(analyticsPath);
  console.log("✓ Analytics data loaded");

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — skipping traffic fetch");
    const previousWeekStats = computePreviousWeekStats(analytics);
    console.log(`\n  Previous week: ${previousWeekStats.views} views, ${previousWeekStats.clicks} clicks, ${previousWeekStats.ctr.toFixed(1)}% CTR`);

    analytics.lastUpdated = new Date().toISOString();
    await saveAnalytics(analytics, analyticsPath);
    console.log("✓ Analytics saved");

    return { success: true, message: "Analytics updated (local mode)" };
  }

  const api = new GitHubAPI(owner, repo);

  try {
    const trafficData = await api.getTrafficViews();
    console.log(`✓ Fetched traffic data: ${trafficData.count} total views`);

    const incomingViews: DailyView[] = trafficData.views.map((v) => ({
      date: v.timestamp.split("T")[0]!,
      count: v.count,
      uniques: v.uniques,
    }));

    analytics.dailyViews = mergeDailyViews(analytics.dailyViews, incomingViews);
    analytics.totalViews = analytics.dailyViews.reduce((sum, dv) => sum + dv.count, 0);
    analytics.uniqueVisitors = analytics.dailyViews.reduce((sum, dv) => sum + dv.uniques, 0);
  } catch (err) {
    console.warn("⚠ Failed to fetch traffic views");
    logError(err, "update-analytics:getTrafficViews");
  }

  try {
    const referrers = await api.getPopularReferrers();
    console.log(`✓ Fetched ${referrers.length} referrers`);
  } catch (err) {
    console.warn("⚠ Failed to fetch referrers");
    logError(err, "update-analytics:getPopularReferrers");
  }

  const clickPayload = process.env["GITHUB_EVENT_PATH"];
  if (clickPayload) {
    try {
      const eventFile = Bun.file(clickPayload);
      if (await eventFile.exists()) {
        const event = JSON.parse(await eventFile.text()) as {
          action?: string;
          client_payload?: { banner_id?: string; timestamp?: string; referrer?: string };
        };
        if (event.client_payload?.banner_id) {
          const bannerId = event.client_payload.banner_id;
          const timestamp = event.client_payload.timestamp ?? new Date().toISOString();
          const referrer = event.client_payload.referrer;
          analytics = recordClick(analytics, bannerId, timestamp, referrer);
          console.log(`✓ Recorded click for banner: ${bannerId}`);
        }
      }
    } catch (err) {
      console.warn("⚠ Failed to process click event");
      logError(err, "update-analytics:processClick");
    }
  }

  if (analytics.periods.length > 0) {
    analytics.periods = computePeriodAggregates(analytics, analytics.periods);
    console.log(`✓ Updated ${analytics.periods.length} period aggregates`);
  }

  const previousWeekStats = computePreviousWeekStats(analytics);
  console.log(`\n  Previous week: ${previousWeekStats.views} views, ${previousWeekStats.clicks} clicks, ${previousWeekStats.ctr.toFixed(1)}% CTR`);

  analytics.lastUpdated = new Date().toISOString();
  await saveAnalytics(analytics, analyticsPath);
  console.log("✓ Analytics saved");

  console.log("\n=== Analytics Update Complete ===");
  return { success: true, message: `Analytics updated: ${analytics.totalViews} total views, ${analytics.clicks.length} clicks` };
}

export { computePreviousWeekStats, mergeDailyViews, computePeriodAggregates };
