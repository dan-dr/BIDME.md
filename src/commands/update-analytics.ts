import { logError } from "../lib/error-handler.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { generateLiveAnalyticsSection, updateBidIssueBody } from "../lib/issue-template.ts";
import type { LegacyAnalyticsData, PeriodAnalytics } from "../lib/types.ts";
import {
  type AnalyticsDailyView,
  readAnalytics,
  readCurrentPeriod,
  type VariableAnalytics,
  writeAnalytics,
} from "../lib/variable-store.ts";

export interface UpdateAnalyticsOptions {
  target?: string;
}

export interface PreviousWeekStats {
  views: number;
  clicks: number;
  ctr: number;
}

function mergeDailyViews(
  existing: AnalyticsDailyView[],
  incoming: AnalyticsDailyView[],
): AnalyticsDailyView[] {
  const map = new Map<string, AnalyticsDailyView>();
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

function getClickThroughRate(views: number, clicks: number): number {
  return views === 0 ? 0 : (clicks / views) * 100;
}

function dailyViewsFor(data: VariableAnalytics | LegacyAnalyticsData): AnalyticsDailyView[] {
  if ("daily_views" in data) return data.daily_views;
  return data.dailyViews;
}

function computePreviousWeekStats(
  data: VariableAnalytics | LegacyAnalyticsData,
): PreviousWeekStats {
  const now = new Date();
  const endOfPreviousWeek = new Date(now);
  endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() - endOfPreviousWeek.getDay());
  endOfPreviousWeek.setHours(0, 0, 0, 0);

  const startOfPreviousWeek = new Date(endOfPreviousWeek);
  startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);

  const startStr = startOfPreviousWeek.toISOString().split("T")[0]!;
  const endStr = endOfPreviousWeek.toISOString().split("T")[0]!;

  const views = dailyViewsFor(data)
    .filter((dv) => dv.date >= startStr && dv.date < endStr)
    .reduce((sum, dv) => sum + dv.count, 0);

  const clicks = data.clicks.filter((c) => {
    const clickDate = c.timestamp.split("T")[0]!;
    return clickDate >= startStr && clickDate < endStr;
  }).length;

  const ctr = getClickThroughRate(views, clicks);

  return { views, clicks, ctr };
}

function computePeriodAggregates<T extends VariableAnalytics["periods"][number] | PeriodAnalytics>(
  data: VariableAnalytics | LegacyAnalyticsData,
  periods: T[],
): T[] {
  return periods.map((p) => {
    const startStr = p.start_date.split("T")[0]!;
    const endStr = p.end_date.split("T")[0]!;

    const views = dailyViewsFor(data)
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

function averageViews7d(analytics: VariableAnalytics): number {
  const recent = analytics.daily_views.slice(-7);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, view) => sum + view.count, 0) / recent.length;
}

function updateAnalyticsSection(body: string, section: string): string {
  const pattern = /<!-- bidme-analytics-start -->[\s\S]*?<!-- bidme-analytics-end -->/;
  if (pattern.test(body)) return body.replace(pattern, section);
  return `${body}\n\n${section}`;
}

export async function runUpdateAnalytics(
  options: UpdateAnalyticsOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BIDME: Updating Analytics ===\n");

  const analytics = await readAnalytics();
  console.log("✓ Analytics data loaded");

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — skipping traffic fetch");
    const previousWeekStats = computePreviousWeekStats(analytics);
    console.log(
      `\n  Previous week: ${previousWeekStats.views} views, ${previousWeekStats.clicks} clicks, ${previousWeekStats.ctr.toFixed(1)}% CTR`,
    );

    analytics.last_updated = new Date().toISOString();
    await writeAnalytics(analytics);
    console.log("✓ Analytics saved");

    return { success: true, message: "Analytics updated (local mode)" };
  }

  const api = new GitHubAPI(owner, repo);

  try {
    const trafficData = await api.getTrafficViews();
    console.log(`✓ Fetched traffic data: ${trafficData.count} total views`);

    const incomingViews: AnalyticsDailyView[] = trafficData.views.map((v) => ({
      date: v.timestamp.split("T")[0]!,
      count: v.count,
      uniques: v.uniques,
    }));

    analytics.daily_views = mergeDailyViews(analytics.daily_views, incomingViews).slice(-90);
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
          analytics.clicks.push({ banner_id: bannerId, timestamp, referrer });
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
  console.log(
    `\n  Previous week: ${previousWeekStats.views} views, ${previousWeekStats.clicks} clicks, ${previousWeekStats.ctr.toFixed(1)}% CTR`,
  );

  analytics.clicks = analytics.clicks.filter((click) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return new Date(click.timestamp).getTime() >= cutoff;
  });
  analytics.last_updated = new Date().toISOString();
  await writeAnalytics(analytics);
  console.log("✓ Analytics saved");

  const period = await readCurrentPeriod();
  if (period?.issue_number) {
    try {
      const issue = await api.getIssue(period.issue_number);
      const periodClicks = analytics.clicks.filter(
        (click) => click.banner_id === period.period_id,
      ).length;
      const views7d = averageViews7d(analytics);
      const ctr = getClickThroughRate(views7d * 7, periodClicks);
      const analyticsSection = generateLiveAnalyticsSection(
        views7d,
        periodClicks,
        ctr,
        analytics.last_updated ?? new Date().toISOString(),
      );
      const withBids = updateBidIssueBody(issue.body, period.bids, analytics.periods.at(-1));
      const updatedBody = updateAnalyticsSection(withBids, analyticsSection);
      await api.updateIssueBody(period.issue_number, updatedBody);
      console.log("✓ Issue dashboard refreshed");
    } catch (err) {
      console.warn("⚠ Failed to refresh issue dashboard");
      logError(err, "update-analytics:updateIssue");
    }
  }

  console.log("\n=== Analytics Update Complete ===");
  const totalViews = analytics.daily_views.reduce((sum, dv) => sum + dv.count, 0);
  return {
    success: true,
    message: `Analytics updated: ${totalViews} total views, ${analytics.clicks.length} clicks`,
  };
}

export { computePeriodAggregates, computePreviousWeekStats, mergeDailyViews };
