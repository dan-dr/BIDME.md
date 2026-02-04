import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import {
  loadAnalyticsFile,
  saveAnalyticsFile,
  mergeDailyViews,
  mergeCountries,
  generateBadges,
  updateReadmeBanner,
} from "../scripts/analytics-updater";
import type { AnalyticsData, DailyView } from "../scripts/analytics-updater";

describe("loadAnalyticsFile", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-analytics-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns defaults when file does not exist", async () => {
    const data = await loadAnalyticsFile(resolve(tempDir, "missing.json"));
    expect(data.totalViews).toBe(0);
    expect(data.uniqueVisitors).toBe(0);
    expect(data.dailyViews).toEqual([]);
    expect(data.clicks).toEqual([]);
    expect(data.countries).toEqual({});
  });

  test("returns defaults for empty file", async () => {
    const path = resolve(tempDir, "empty.json");
    await Bun.write(path, "");
    const data = await loadAnalyticsFile(path);
    expect(data.totalViews).toBe(0);
    expect(data.dailyViews).toEqual([]);
  });

  test("returns defaults for invalid JSON", async () => {
    const path = resolve(tempDir, "bad.json");
    await Bun.write(path, "not json {{{");
    const data = await loadAnalyticsFile(path);
    expect(data.totalViews).toBe(0);
  });

  test("loads existing analytics data", async () => {
    const path = resolve(tempDir, "existing.json");
    const existing: AnalyticsData = {
      totalViews: 500,
      uniqueVisitors: 200,
      dailyViews: [{ date: "2026-01-01", count: 100, uniques: 50 }],
      clicks: [{ banner_id: "b1", timestamp: "2026-01-01T00:00:00Z" }],
      countries: { "google.com": 30 },
      lastUpdated: "2026-01-01T00:00:00Z",
    };
    await Bun.write(path, JSON.stringify(existing));
    const data = await loadAnalyticsFile(path);
    expect(data.totalViews).toBe(500);
    expect(data.uniqueVisitors).toBe(200);
    expect(data.dailyViews).toHaveLength(1);
    expect(data.clicks).toHaveLength(1);
    expect(data.countries["google.com"]).toBe(30);
  });
});

describe("saveAnalyticsFile", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-analytics-save-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("writes analytics data to file", async () => {
    const path = resolve(tempDir, "data", "analytics.json");
    const data: AnalyticsData = {
      totalViews: 100,
      uniqueVisitors: 50,
      dailyViews: [],
      clicks: [],
      countries: {},
      lastUpdated: "2026-01-01T00:00:00Z",
    };
    await saveAnalyticsFile(path, data);
    const loaded = await loadAnalyticsFile(path);
    expect(loaded.totalViews).toBe(100);
    expect(loaded.uniqueVisitors).toBe(50);
  });

  test("creates parent directories", async () => {
    const path = resolve(tempDir, "nested", "deep", "analytics.json");
    await saveAnalyticsFile(path, {
      totalViews: 0,
      uniqueVisitors: 0,
      dailyViews: [],
      clicks: [],
      countries: {},
      lastUpdated: "",
    });
    const file = Bun.file(path);
    expect(await file.exists()).toBe(true);
  });
});

describe("mergeDailyViews", () => {
  test("merges new views with empty existing", () => {
    const incoming = [
      { timestamp: "2026-01-01T00:00:00Z", count: 10, uniques: 5 },
      { timestamp: "2026-01-02T00:00:00Z", count: 20, uniques: 8 },
    ];
    const result = mergeDailyViews([], incoming);
    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe("2026-01-01");
    expect(result[0]!.count).toBe(10);
    expect(result[1]!.date).toBe("2026-01-02");
    expect(result[1]!.count).toBe(20);
  });

  test("updates existing entries with higher counts", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 5, uniques: 3 },
    ];
    const incoming = [
      { timestamp: "2026-01-01T00:00:00Z", count: 10, uniques: 7 },
    ];
    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(10);
    expect(result[0]!.uniques).toBe(7);
  });

  test("keeps existing entries with higher counts", () => {
    const existing: DailyView[] = [
      { date: "2026-01-01", count: 15, uniques: 10 },
    ];
    const incoming = [
      { timestamp: "2026-01-01T00:00:00Z", count: 10, uniques: 7 },
    ];
    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(15);
  });

  test("sorts results by date", () => {
    const incoming = [
      { timestamp: "2026-01-03T00:00:00Z", count: 30, uniques: 15 },
      { timestamp: "2026-01-01T00:00:00Z", count: 10, uniques: 5 },
    ];
    const result = mergeDailyViews([], incoming);
    expect(result[0]!.date).toBe("2026-01-01");
    expect(result[1]!.date).toBe("2026-01-03");
  });

  test("accumulates data across multiple merges", () => {
    const existing: DailyView[] = [
      { date: "2025-12-30", count: 50, uniques: 20 },
      { date: "2025-12-31", count: 40, uniques: 15 },
    ];
    const incoming = [
      { timestamp: "2025-12-31T00:00:00Z", count: 45, uniques: 18 },
      { timestamp: "2026-01-01T00:00:00Z", count: 10, uniques: 5 },
    ];
    const result = mergeDailyViews(existing, incoming);
    expect(result).toHaveLength(3);
    expect(result[0]!.date).toBe("2025-12-30");
    expect(result[0]!.count).toBe(50);
    expect(result[1]!.date).toBe("2025-12-31");
    expect(result[1]!.count).toBe(45);
    expect(result[2]!.date).toBe("2026-01-01");
    expect(result[2]!.count).toBe(10);
  });
});

describe("mergeCountries", () => {
  test("adds new referrers", () => {
    const result = mergeCountries({}, [
      { referrer: "google.com", count: 10, uniques: 5 },
      { referrer: "github.com", count: 20, uniques: 8 },
    ]);
    expect(result["google.com"]).toBe(10);
    expect(result["github.com"]).toBe(20);
  });

  test("takes higher count when merging", () => {
    const result = mergeCountries({ "google.com": 15 }, [
      { referrer: "google.com", count: 10, uniques: 5 },
    ]);
    expect(result["google.com"]).toBe(15);
  });

  test("updates with higher incoming count", () => {
    const result = mergeCountries({ "google.com": 5 }, [
      { referrer: "google.com", count: 10, uniques: 5 },
    ]);
    expect(result["google.com"]).toBe(10);
  });

  test("preserves existing entries not in incoming", () => {
    const result = mergeCountries(
      { "bing.com": 5, "google.com": 10 },
      [{ referrer: "github.com", count: 20, uniques: 8 }],
    );
    expect(result["bing.com"]).toBe(5);
    expect(result["google.com"]).toBe(10);
    expect(result["github.com"]).toBe(20);
  });
});

describe("generateBadges", () => {
  test("generates all three badges", () => {
    const analytics: AnalyticsData = {
      totalViews: 1200,
      uniqueVisitors: 500,
      dailyViews: [],
      clicks: [
        { banner_id: "b1", timestamp: "2026-01-01T00:00:00Z" },
        { banner_id: "b1", timestamp: "2026-01-02T00:00:00Z" },
      ],
      countries: { "google.com": 10, "github.com": 20 },
      lastUpdated: "",
    };
    const badges = generateBadges(analytics);
    expect(badges).toHaveLength(3);
    expect(badges[0]).toContain("views");
    expect(badges[0]).toContain("1.2k");
    expect(badges[1]).toContain("countries");
    expect(badges[1]).toContain("2");
    expect(badges[2]).toContain("CTR");
  });

  test("handles zero views (no division by zero)", () => {
    const analytics: AnalyticsData = {
      totalViews: 0,
      uniqueVisitors: 0,
      dailyViews: [],
      clicks: [],
      countries: {},
      lastUpdated: "",
    };
    const badges = generateBadges(analytics);
    expect(badges).toHaveLength(3);
    expect(badges[2]).toContain("0.0%25");
  });
});

describe("updateReadmeBanner", () => {
  test("updates badges within banner markers", () => {
    const readme = [
      "# My Repo",
      "<!-- BIDME:BANNER:START -->",
      "[![BidMe Banner](https://example.com/banner.png)](https://example.com)",
      "",
      "![Views](https://img.shields.io/badge/views-100-blue)",
      "<!-- BIDME:BANNER:END -->",
      "## Content",
    ].join("\n");

    const badges = [
      "![Views](https://img.shields.io/badge/views-500-blue)",
      "![Countries](https://img.shields.io/badge/countries-5-green)",
    ];
    const result = updateReadmeBanner(readme, badges);

    expect(result).toContain("<!-- BIDME:BANNER:START -->");
    expect(result).toContain("<!-- BIDME:BANNER:END -->");
    expect(result).toContain("[![BidMe Banner](https://example.com/banner.png)](https://example.com)");
    expect(result).toContain("views-500-blue");
    expect(result).toContain("countries-5-green");
    expect(result).not.toContain("views-100-blue");
  });

  test("returns unchanged readme without markers", () => {
    const readme = "# My Repo\nNo markers here\n";
    const result = updateReadmeBanner(readme, ["badge1"]);
    expect(result).toBe(readme);
  });

  test("handles banner section with no banner link", () => {
    const readme = [
      "<!-- BIDME:BANNER:START -->",
      "No banner yet",
      "<!-- BIDME:BANNER:END -->",
    ].join("\n");
    const badges = ["![Views](https://img.shields.io/badge/views-0-blue)"];
    const result = updateReadmeBanner(readme, badges);
    expect(result).toContain("views-0-blue");
  });

  test("preserves content outside markers", () => {
    const readme = [
      "# Header",
      "Some text before",
      "<!-- BIDME:BANNER:START -->",
      "[![BidMe Banner](https://example.com/ad.png)](https://example.com)",
      "<!-- BIDME:BANNER:END -->",
      "Some text after",
    ].join("\n");
    const result = updateReadmeBanner(readme, ["![Views](badge)"]);
    expect(result).toContain("# Header");
    expect(result).toContain("Some text before");
    expect(result).toContain("Some text after");
  });
});
