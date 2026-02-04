import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import {
  loadAnalytics,
  saveAnalytics,
  recordClick,
  getClickThroughRate,
  aggregateByPeriod,
} from "../../scripts/utils/analytics-store.ts";
import type { AnalyticsData } from "../../scripts/utils/analytics-store.ts";

function makeAnalytics(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    totalViews: 0,
    uniqueVisitors: 0,
    dailyViews: [],
    clicks: [],
    countries: {},
    periods: [],
    lastUpdated: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("loadAnalytics", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-store-load-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns defaults when file does not exist", async () => {
    const data = await loadAnalytics(resolve(tempDir, "missing.json"));
    expect(data.totalViews).toBe(0);
    expect(data.uniqueVisitors).toBe(0);
    expect(data.dailyViews).toEqual([]);
    expect(data.clicks).toEqual([]);
    expect(data.countries).toEqual({});
    expect(data.periods).toEqual([]);
  });

  test("returns defaults for empty file", async () => {
    const path = resolve(tempDir, "empty.json");
    await Bun.write(path, "");
    const data = await loadAnalytics(path);
    expect(data.totalViews).toBe(0);
    expect(data.periods).toEqual([]);
  });

  test("returns defaults for invalid JSON", async () => {
    const path = resolve(tempDir, "bad.json");
    await Bun.write(path, "not valid json {{{");
    const data = await loadAnalytics(path);
    expect(data.totalViews).toBe(0);
    expect(data.clicks).toEqual([]);
  });

  test("loads existing analytics data", async () => {
    const path = resolve(tempDir, "existing.json");
    const existing = makeAnalytics({
      totalViews: 750,
      uniqueVisitors: 300,
      dailyViews: [{ date: "2026-01-15", count: 50, uniques: 20 }],
      clicks: [{ banner_id: "b1", timestamp: "2026-01-15T10:00:00Z" }],
      countries: { "google.com": 40 },
      periods: [
        { period_id: "period-2026-01-01", views: 500, clicks: 10, ctr: 2.0, start_date: "2026-01-01T00:00:00Z", end_date: "2026-01-08T00:00:00Z" },
      ],
    });
    await Bun.write(path, JSON.stringify(existing));
    const data = await loadAnalytics(path);
    expect(data.totalViews).toBe(750);
    expect(data.uniqueVisitors).toBe(300);
    expect(data.dailyViews).toHaveLength(1);
    expect(data.clicks).toHaveLength(1);
    expect(data.countries["google.com"]).toBe(40);
    expect(data.periods).toHaveLength(1);
    expect(data.periods[0]!.period_id).toBe("period-2026-01-01");
  });

  test("fills missing fields with defaults from partial data", async () => {
    const path = resolve(tempDir, "partial.json");
    await Bun.write(path, JSON.stringify({ totalViews: 100 }));
    const data = await loadAnalytics(path);
    expect(data.totalViews).toBe(100);
    expect(data.uniqueVisitors).toBe(0);
    expect(data.dailyViews).toEqual([]);
    expect(data.clicks).toEqual([]);
    expect(data.countries).toEqual({});
    expect(data.periods).toEqual([]);
  });
});

describe("saveAnalytics", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-store-save-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("writes analytics data and can be read back", async () => {
    const path = resolve(tempDir, "data", "analytics.json");
    const data = makeAnalytics({ totalViews: 200, uniqueVisitors: 80 });
    await saveAnalytics(data, path);
    const loaded = await loadAnalytics(path);
    expect(loaded.totalViews).toBe(200);
    expect(loaded.uniqueVisitors).toBe(80);
    expect(loaded.periods).toEqual([]);
  });

  test("creates parent directories", async () => {
    const path = resolve(tempDir, "nested", "deep", "analytics.json");
    await saveAnalytics(makeAnalytics(), path);
    const file = Bun.file(path);
    expect(await file.exists()).toBe(true);
  });

  test("overwrites existing data", async () => {
    const path = resolve(tempDir, "overwrite.json");
    await saveAnalytics(makeAnalytics({ totalViews: 100 }), path);
    await saveAnalytics(makeAnalytics({ totalViews: 500 }), path);
    const loaded = await loadAnalytics(path);
    expect(loaded.totalViews).toBe(500);
  });
});

describe("recordClick", () => {
  test("appends a click event with banner id and timestamp", () => {
    const data = makeAnalytics();
    const result = recordClick(data, "banner-1", "2026-02-01T12:00:00Z");
    expect(result.clicks).toHaveLength(1);
    expect(result.clicks[0]!.banner_id).toBe("banner-1");
    expect(result.clicks[0]!.timestamp).toBe("2026-02-01T12:00:00Z");
    expect(result.clicks[0]!.referrer).toBeUndefined();
  });

  test("appends a click event with referrer", () => {
    const data = makeAnalytics();
    const result = recordClick(data, "banner-2", "2026-02-01T14:00:00Z", "github.com/user/repo");
    expect(result.clicks).toHaveLength(1);
    expect(result.clicks[0]!.referrer).toBe("github.com/user/repo");
  });

  test("preserves existing clicks", () => {
    const data = makeAnalytics({
      clicks: [{ banner_id: "old", timestamp: "2026-01-01T00:00:00Z" }],
    });
    const result = recordClick(data, "new", "2026-02-01T00:00:00Z");
    expect(result.clicks).toHaveLength(2);
    expect(result.clicks[0]!.banner_id).toBe("old");
    expect(result.clicks[1]!.banner_id).toBe("new");
  });

  test("does not mutate original data", () => {
    const data = makeAnalytics();
    const result = recordClick(data, "b1", "2026-02-01T00:00:00Z");
    expect(data.clicks).toHaveLength(0);
    expect(result.clicks).toHaveLength(1);
  });
});

describe("getClickThroughRate", () => {
  test("calculates CTR as percentage", () => {
    expect(getClickThroughRate(1000, 25)).toBe(2.5);
  });

  test("returns 0 when views is 0", () => {
    expect(getClickThroughRate(0, 10)).toBe(0);
  });

  test("returns 0 when views is negative", () => {
    expect(getClickThroughRate(-5, 10)).toBe(0);
  });

  test("returns 0 when clicks is 0", () => {
    expect(getClickThroughRate(500, 0)).toBe(0);
  });

  test("handles 100% CTR", () => {
    expect(getClickThroughRate(50, 50)).toBe(100);
  });

  test("handles very small CTR", () => {
    const rate = getClickThroughRate(100000, 1);
    expect(rate).toBeCloseTo(0.001, 5);
  });
});

describe("aggregateByPeriod", () => {
  const data = makeAnalytics({
    periods: [
      { period_id: "period-2026-01-01", views: 500, clicks: 10, ctr: 2.0, start_date: "2026-01-01T00:00:00Z", end_date: "2026-01-08T00:00:00Z" },
      { period_id: "period-2026-01-08", views: 800, clicks: 20, ctr: 2.5, start_date: "2026-01-08T00:00:00Z", end_date: "2026-01-15T00:00:00Z" },
    ],
  });

  test("returns period analytics for matching period_id", () => {
    const result = aggregateByPeriod(data, "period-2026-01-01");
    expect(result).not.toBeNull();
    expect(result!.views).toBe(500);
    expect(result!.clicks).toBe(10);
    expect(result!.ctr).toBe(2.0);
  });

  test("returns a different period", () => {
    const result = aggregateByPeriod(data, "period-2026-01-08");
    expect(result).not.toBeNull();
    expect(result!.views).toBe(800);
  });

  test("returns null for non-existent period", () => {
    const result = aggregateByPeriod(data, "period-2099-01-01");
    expect(result).toBeNull();
  });

  test("returns null when no periods exist", () => {
    const emptyData = makeAnalytics();
    const result = aggregateByPeriod(emptyData, "period-2026-01-01");
    expect(result).toBeNull();
  });
});
