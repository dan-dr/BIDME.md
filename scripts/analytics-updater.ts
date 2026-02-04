import { GitHubAPI } from "./utils/github-api";
import {
  generateViewsBadge,
  generateCountriesBadge,
  generateCTRBadge,
} from "./utils/badge-generator";
import { resolve } from "path";
import { mkdir } from "fs/promises";

export interface DailyView {
  date: string;
  count: number;
  uniques: number;
}

export interface ClickEvent {
  banner_id: string;
  timestamp: string;
  referrer?: string;
}

export interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  dailyViews: DailyView[];
  clicks: ClickEvent[];
  countries: Record<string, number>;
  lastUpdated: string;
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalViews: 0,
  uniqueVisitors: 0,
  dailyViews: [],
  clicks: [],
  countries: {},
  lastUpdated: new Date().toISOString(),
};

export async function loadAnalyticsFile(
  path: string,
): Promise<AnalyticsData> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {} };
  }
  try {
    const text = await file.text();
    if (!text.trim()) {
      return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {} };
    }
    return JSON.parse(text) as AnalyticsData;
  } catch {
    return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {} };
  }
}

export async function saveAnalyticsFile(
  path: string,
  data: AnalyticsData,
): Promise<void> {
  const dir = resolve(path, "..");
  await mkdir(dir, { recursive: true });
  await Bun.write(path, JSON.stringify(data, null, 2));
}

export function mergeDailyViews(
  existing: DailyView[],
  incoming: { timestamp: string; count: number; uniques: number }[],
): DailyView[] {
  const map = new Map<string, DailyView>();
  for (const dv of existing) {
    map.set(dv.date, dv);
  }
  for (const v of incoming) {
    const date = v.timestamp.split("T")[0]!;
    const current = map.get(date);
    if (!current || v.count > current.count) {
      map.set(date, { date, count: v.count, uniques: v.uniques });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeCountries(
  existing: Record<string, number>,
  referrers: { referrer: string; count: number; uniques: number }[],
): Record<string, number> {
  const merged = { ...existing };
  for (const r of referrers) {
    const key = r.referrer;
    merged[key] = Math.max(merged[key] ?? 0, r.count);
  }
  return merged;
}

export function generateBadges(analytics: AnalyticsData): string[] {
  const badges: string[] = [];
  badges.push(generateViewsBadge(analytics.totalViews));
  const countryCount = Object.keys(analytics.countries).length;
  badges.push(generateCountriesBadge(countryCount));
  const ctr =
    analytics.totalViews > 0
      ? (analytics.clicks.length / analytics.totalViews) * 100
      : 0;
  badges.push(generateCTRBadge(ctr));
  return badges;
}

export function updateReadmeBanner(
  readme: string,
  badges: string[],
): string {
  const badgeLine = badges.join(" ");
  const startMarker = "<!-- BIDME:BANNER:START -->";
  const endMarker = "<!-- BIDME:BANNER:END -->";
  const regex = new RegExp(
    `${startMarker}[\\s\\S]*?${endMarker}`,
  );

  if (!regex.test(readme)) {
    return readme;
  }

  return readme.replace(regex, (match) => {
    const inner = match
      .replace(startMarker, "")
      .replace(endMarker, "")
      .trim();
    const lines = inner.split("\n");
    const bannerLine = lines.find((l) => l.startsWith("[!["));
    if (!bannerLine) {
      return `${startMarker}\n${badgeLine}\n${endMarker}`;
    }
    return `${startMarker}\n${bannerLine}\n\n${badgeLine}\n${endMarker}`;
  });
}

export async function updateAnalytics(): Promise<{
  success: boolean;
  message: string;
}> {
  console.log("=== BidMe: Updating Analytics ===\n");

  const analyticsPath = resolve(process.cwd(), "data/analytics.json");
  const analytics = await loadAnalyticsFile(analyticsPath);
  console.log("✓ Loaded existing analytics");

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const repo = process.env["GITHUB_REPOSITORY"]?.split("/")[1] ?? "";

  if (!owner || !repo) {
    console.log("⚠ GitHub environment not configured — running in local mode");
    analytics.lastUpdated = new Date().toISOString();
    await saveAnalyticsFile(analyticsPath, analytics);
    return { success: true, message: "Analytics saved (local mode)" };
  }

  const api = new GitHubAPI(owner, repo);

  try {
    const views = await api.getTrafficViews();
    console.log(`  Traffic views: ${views.count} total, ${views.uniques} unique`);

    analytics.dailyViews = mergeDailyViews(analytics.dailyViews, views.views);
    analytics.totalViews = analytics.dailyViews.reduce((s, d) => s + d.count, 0);
    analytics.uniqueVisitors = analytics.dailyViews.reduce(
      (s, d) => s + d.uniques,
      0,
    );
  } catch (err) {
    console.error("⚠ Failed to fetch traffic views:", err);
  }

  try {
    const referrers = await api.getPopularReferrers();
    console.log(`  Referrers: ${referrers.length} sources`);
    analytics.countries = mergeCountries(analytics.countries, referrers);
  } catch (err) {
    console.error("⚠ Failed to fetch referrers:", err);
  }

  analytics.lastUpdated = new Date().toISOString();
  await saveAnalyticsFile(analyticsPath, analytics);
  console.log("✓ Analytics data saved");

  const badges = generateBadges(analytics);
  console.log(`✓ Generated ${badges.length} badges`);

  try {
    const readmePath = resolve(process.cwd(), "README.md");
    const readmeFile = Bun.file(readmePath);
    if (await readmeFile.exists()) {
      const readme = await readmeFile.text();
      const updated = updateReadmeBanner(readme, badges);
      if (updated !== readme) {
        await Bun.write(readmePath, updated);
        console.log("✓ README badges updated");
      } else {
        console.log("  README unchanged (no banner markers or no change)");
      }
    }
  } catch (err) {
    console.error("⚠ Failed to update README:", err);
  }

  const msg = `Analytics updated: ${analytics.totalViews} views, ${Object.keys(analytics.countries).length} referrers`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}

if (import.meta.main) {
  updateAnalytics().catch((err) => {
    console.error("Error updating analytics:", err);
    process.exit(1);
  });
}
