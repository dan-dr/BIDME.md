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

export interface PeriodAnalytics {
  period_id: string;
  views: number;
  clicks: number;
  ctr: number;
  start_date: string;
  end_date: string;
}

export interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  dailyViews: DailyView[];
  clicks: ClickEvent[];
  countries: Record<string, number>;
  periods: PeriodAnalytics[];
  lastUpdated: string;
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalViews: 0,
  uniqueVisitors: 0,
  dailyViews: [],
  clicks: [],
  countries: {},
  periods: [],
  lastUpdated: new Date().toISOString(),
};

const DEFAULT_PATH = resolve(process.cwd(), ".bidme/data/analytics.json");

export async function loadAnalytics(
  path: string = DEFAULT_PATH,
): Promise<AnalyticsData> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {}, periods: [] };
  }
  try {
    const text = await file.text();
    if (!text.trim()) {
      return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {}, periods: [] };
    }
    const parsed = JSON.parse(text) as Partial<AnalyticsData>;
    return {
      totalViews: parsed.totalViews ?? 0,
      uniqueVisitors: parsed.uniqueVisitors ?? 0,
      dailyViews: parsed.dailyViews ?? [],
      clicks: parsed.clicks ?? [],
      countries: parsed.countries ?? {},
      periods: parsed.periods ?? [],
      lastUpdated: parsed.lastUpdated ?? new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_ANALYTICS, dailyViews: [], clicks: [], countries: {}, periods: [] };
  }
}

export async function saveAnalytics(
  data: AnalyticsData,
  path: string = DEFAULT_PATH,
): Promise<void> {
  const dir = resolve(path, "..");
  await mkdir(dir, { recursive: true });
  await Bun.write(path, JSON.stringify(data, null, 2));
}

export function recordClick(
  data: AnalyticsData,
  bannerId: string,
  timestamp: string,
  referrer?: string,
): AnalyticsData {
  const click: ClickEvent = { banner_id: bannerId, timestamp };
  if (referrer) {
    click.referrer = referrer;
  }
  return {
    ...data,
    clicks: [...data.clicks, click],
  };
}

export function getClickThroughRate(views: number, clicks: number): number {
  if (views <= 0) return 0;
  return (clicks / views) * 100;
}

export function aggregateByPeriod(
  data: AnalyticsData,
  periodId: string,
): PeriodAnalytics | null {
  const period = data.periods.find((p) => p.period_id === periodId);
  return period ?? null;
}
