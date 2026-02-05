import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import type { AnalyticsData, DailyView, PeriodAnalytics } from "../../lib/analytics-store.js";
import {
  mergeDailyViews,
  computePreviousWeekStats,
  computePeriodAggregates,
  runUpdateAnalytics,
} from "../update-analytics.js";
import { generateStatsSection } from "../../lib/issue-template.js";

function makeAnalytics(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    totalViews: 0,
    uniqueVisitors: 0,
    dailyViews: [],
    clicks: [],
    countries: {},
    periods: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe("mergeDailyViews", () => {
  test("merges non-overlapping dates", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 10, uniques: 5 },
    ];
    const incoming: DailyView[] = [
      { date: "2026-01-02", count: 20, uniques: 8 },
    ];

    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe("2026-01-01");
    expect(result[1]!.date).toBe("2026-01-02");
  });

  test("keeps highest count for duplicate dates", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 10, uniques: 5 },
    ];
    const incoming: DailyView[] = [
      { date: "2026-01-01", count: 25, uniques: 3 },
    ];

    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(25);
    expect(result[0]!.uniques).toBe(5);
  });

  test("keeps existing when existing count is higher", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 50, uniques: 20 },
    ];
    const incoming: DailyView[] = [
      { date: "2026-01-01", count: 30, uniques: 25 },
    ];

    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(50);
    expect(result[0]!.uniques).toBe(25);
  });

  test("sorts result by date ascending", () => {
    const existing: DailyView[] = [
      { date: "2026-01-05", count: 10, uniques: 5 },
    ];
    const incoming: DailyView[] = [
      { date: "2026-01-01", count: 20, uniques: 8 },
      { date: "2026-01-03", count: 15, uniques: 7 },
    ];

    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(3);
    expect(result[0]!.date).toBe("2026-01-01");
    expect(result[1]!.date).toBe("2026-01-03");
    expect(result[2]!.date).toBe("2026-01-05");
  });

  test("handles empty existing array", () => {
    const incoming: DailyView[] = [
      { date: "2026-01-01", count: 10, uniques: 5 },
    ];

    const result = mergeDailyViews([], incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(10);
  });

  test("handles empty incoming array", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 10, uniques: 5 },
    ];

    const result = mergeDailyViews(existing, []);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(10);
  });

  test("handles both arrays empty", () => {
    const result = mergeDailyViews([], []);
    expect(result).toHaveLength(0);
  });

  test("deduplicates multiple overlapping dates", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 10, uniques: 5 },
      { date: "2026-01-02", count: 20, uniques: 10 },
      { date: "2026-01-03", count: 30, uniques: 15 },
    ];
    const incoming: DailyView[] = [
      { date: "2026-01-02", count: 25, uniques: 8 },
      { date: "2026-01-03", count: 15, uniques: 20 },
      { date: "2026-01-04", count: 40, uniques: 18 },
    ];

    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(4);
    expect(result.find((d) => d.date === "2026-01-02")!.count).toBe(25);
    expect(result.find((d) => d.date === "2026-01-03")!.count).toBe(30);
    expect(result.find((d) => d.date === "2026-01-03")!.uniques).toBe(20);
  });
});

describe("computePreviousWeekStats", () => {
  function getPreviousWeekRange(): { startStr: string; endStr: string } {
    const now = new Date();
    const endOfPreviousWeek = new Date(now);
    endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() - endOfPreviousWeek.getDay());
    endOfPreviousWeek.setHours(0, 0, 0, 0);

    const startOfPreviousWeek = new Date(endOfPreviousWeek);
    startOfPreviousWeek.setDate(startOfPreviousWeek.getDate() - 7);

    return {
      startStr: startOfPreviousWeek.toISOString().split("T")[0]!,
      endStr: endOfPreviousWeek.toISOString().split("T")[0]!,
    };
  }

  test("sums views within previous week window", () => {
    const { startStr, endStr } = getPreviousWeekRange();
    const d1 = startStr;
    const d2 = new Date(new Date(startStr).getTime() + 86400000).toISOString().split("T")[0]!;

    const data = makeAnalytics({
      dailyViews: [
        { date: d1, count: 100, uniques: 50 },
        { date: d2, count: 200, uniques: 80 },
      ],
    });

    const stats = computePreviousWeekStats(data);
    expect(stats.views).toBe(300);
  });

  test("excludes views outside the previous week window", () => {
    const { startStr } = getPreviousWeekRange();
    const outsideDate = new Date(new Date(startStr).getTime() - 86400000 * 14).toISOString().split("T")[0]!;

    const data = makeAnalytics({
      dailyViews: [
        { date: outsideDate, count: 999, uniques: 500 },
      ],
    });

    const stats = computePreviousWeekStats(data);
    expect(stats.views).toBe(0);
  });

  test("counts clicks within previous week window", () => {
    const { startStr } = getPreviousWeekRange();

    const data = makeAnalytics({
      clicks: [
        { banner_id: "b1", timestamp: `${startStr}T09:00:00.000Z` },
        { banner_id: "b2", timestamp: `${startStr}T15:00:00.000Z` },
      ],
    });

    const stats = computePreviousWeekStats(data);
    expect(stats.clicks).toBe(2);
  });

  test("computes CTR correctly", () => {
    const { startStr } = getPreviousWeekRange();

    const data = makeAnalytics({
      dailyViews: [{ date: startStr, count: 100, uniques: 50 }],
      clicks: [
        { banner_id: "b1", timestamp: `${startStr}T09:00:00.000Z` },
        { banner_id: "b2", timestamp: `${startStr}T10:00:00.000Z` },
      ],
    });

    const stats = computePreviousWeekStats(data);
    expect(stats.ctr).toBe(2);
  });

  test("returns zero CTR when no views", () => {
    const data = makeAnalytics();
    const stats = computePreviousWeekStats(data);
    expect(stats.views).toBe(0);
    expect(stats.clicks).toBe(0);
    expect(stats.ctr).toBe(0);
  });

  test("handles empty analytics data gracefully", () => {
    const data = makeAnalytics();
    const stats = computePreviousWeekStats(data);
    expect(stats.views).toBe(0);
    expect(stats.clicks).toBe(0);
    expect(stats.ctr).toBe(0);
  });
});

describe("computePeriodAggregates", () => {
  test("computes views and clicks for a period", () => {
    const data = makeAnalytics({
      dailyViews: [
        { date: "2026-01-01", count: 100, uniques: 50 },
        { date: "2026-01-02", count: 200, uniques: 80 },
        { date: "2026-01-08", count: 500, uniques: 200 }, // outside period
      ],
      clicks: [
        { banner_id: "b1", timestamp: "2026-01-01T09:00:00.000Z" },
        { banner_id: "b2", timestamp: "2026-01-02T10:00:00.000Z" },
        { banner_id: "b3", timestamp: "2026-01-10T10:00:00.000Z" }, // outside period
      ],
    });

    const periods: PeriodAnalytics[] = [
      {
        period_id: "p1",
        views: 0,
        clicks: 0,
        ctr: 0,
        start_date: "2026-01-01",
        end_date: "2026-01-07",
      },
    ];

    const result = computePeriodAggregates(data, periods);
    expect(result).toHaveLength(1);
    expect(result[0]!.views).toBe(300);
    expect(result[0]!.clicks).toBe(2);
    expect(result[0]!.ctr).toBeCloseTo(0.667, 0);
  });

  test("handles empty periods array", () => {
    const data = makeAnalytics({
      dailyViews: [{ date: "2026-01-01", count: 100, uniques: 50 }],
    });

    const result = computePeriodAggregates(data, []);
    expect(result).toHaveLength(0);
  });

  test("handles period with no matching data", () => {
    const data = makeAnalytics({
      dailyViews: [{ date: "2026-02-01", count: 100, uniques: 50 }],
    });

    const periods: PeriodAnalytics[] = [
      {
        period_id: "p1",
        views: 0,
        clicks: 0,
        ctr: 0,
        start_date: "2026-01-01",
        end_date: "2026-01-07",
      },
    ];

    const result = computePeriodAggregates(data, periods);
    expect(result[0]!.views).toBe(0);
    expect(result[0]!.clicks).toBe(0);
    expect(result[0]!.ctr).toBe(0);
  });

  test("computes aggregates for multiple periods", () => {
    const data = makeAnalytics({
      dailyViews: [
        { date: "2026-01-01", count: 100, uniques: 50 },
        { date: "2026-01-08", count: 200, uniques: 80 },
      ],
      clicks: [
        { banner_id: "b1", timestamp: "2026-01-01T09:00:00.000Z" },
        { banner_id: "b2", timestamp: "2026-01-08T10:00:00.000Z" },
      ],
    });

    const periods: PeriodAnalytics[] = [
      { period_id: "p1", views: 0, clicks: 0, ctr: 0, start_date: "2026-01-01", end_date: "2026-01-07" },
      { period_id: "p2", views: 0, clicks: 0, ctr: 0, start_date: "2026-01-08", end_date: "2026-01-14" },
    ];

    const result = computePeriodAggregates(data, periods);
    expect(result[0]!.views).toBe(100);
    expect(result[0]!.clicks).toBe(1);
    expect(result[1]!.views).toBe(200);
    expect(result[1]!.clicks).toBe(1);
  });
});

describe("stats section markdown generation", () => {
  test("shows first bidding period message when no stats", () => {
    const section = generateStatsSection();
    expect(section).toContain("First bidding period — no previous stats yet");
  });

  test("shows stats with views, clicks, and CTR", () => {
    const stats: PeriodAnalytics = {
      period_id: "p1",
      views: 1500,
      clicks: 45,
      ctr: 3.0,
      start_date: "2026-01-01",
      end_date: "2026-01-07",
    };
    const section = generateStatsSection(stats);
    expect(section).toContain("1500 views");
    expect(section).toContain("45 clicks");
    expect(section).toContain("3.0% CTR");
  });

  test("formats zero stats correctly", () => {
    const stats: PeriodAnalytics = {
      period_id: "p1",
      views: 0,
      clicks: 0,
      ctr: 0,
      start_date: "2026-01-01",
      end_date: "2026-01-07",
    };
    const section = generateStatsSection(stats);
    expect(section).toContain("0 views");
    expect(section).toContain("0 clicks");
    expect(section).toContain("0.0% CTR");
  });
});

describe("runUpdateAnalytics", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-analytics-"));
    await mkdir(join(tempDir, ".bidme/data"), { recursive: true });
    delete process.env["GITHUB_REPOSITORY_OWNER"];
    delete process.env["GITHUB_REPOSITORY"];
    delete process.env["GITHUB_EVENT_PATH"];
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env["GITHUB_REPOSITORY_OWNER"] = originalEnv["GITHUB_REPOSITORY_OWNER"];
    process.env["GITHUB_REPOSITORY"] = originalEnv["GITHUB_REPOSITORY"];
    process.env["GITHUB_EVENT_PATH"] = originalEnv["GITHUB_EVENT_PATH"];
    mock.restore();
  });

  test("succeeds with empty analytics in local mode", async () => {
    await Bun.write(
      join(tempDir, ".bidme/data/analytics.json"),
      JSON.stringify(makeAnalytics()),
    );

    const result = await runUpdateAnalytics({ target: tempDir });
    expect(result.success).toBe(true);
    expect(result.message).toContain("local mode");
  });

  test("saves updated lastUpdated timestamp", async () => {
    const oldAnalytics = makeAnalytics({ lastUpdated: "2020-01-01T00:00:00.000Z" });
    await Bun.write(
      join(tempDir, ".bidme/data/analytics.json"),
      JSON.stringify(oldAnalytics),
    );

    await runUpdateAnalytics({ target: tempDir });

    const saved = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/analytics.json")).text(),
    ) as AnalyticsData;
    expect(saved.lastUpdated).not.toBe("2020-01-01T00:00:00.000Z");
  });

  test("handles missing analytics file gracefully", async () => {
    const result = await runUpdateAnalytics({ target: tempDir });
    expect(result.success).toBe(true);
  });

  test("produces graceful output with completely empty data", async () => {
    const result = await runUpdateAnalytics({ target: tempDir });
    expect(result.success).toBe(true);
    expect(result.message).toContain("local mode");
  });
});
