import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import type { PeriodData, BidRecord } from "../../lib/types.js";
import type { AnalyticsData } from "../../lib/analytics-store.js";
import {
  getTodayViews,
  getTodayClicks,
  formatRecap,
  runDailyRecap,
} from "../daily-recap.js";

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

function makeBid(overrides: Partial<BidRecord> = {}): BidRecord {
  return {
    bidder: "bidder1",
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    contact: "bid@example.com",
    status: "approved",
    comment_id: 1001,
    timestamp: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

function makePeriodData(bids: BidRecord[] = []): PeriodData {
  return {
    period_id: "period-2026-02-01",
    status: "open",
    start_date: "2026-02-01T00:00:00.000Z",
    end_date: "2026-02-08T00:00:00.000Z",
    issue_number: 42,
    issue_url: "https://github.com/testowner/testrepo/issues/42",
    bids,
    created_at: "2026-02-01T00:00:00.000Z",
  };
}

const today = new Date().toISOString().split("T")[0]!;

describe("daily-recap", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-recap-"));
    await mkdir(join(tempDir, ".bidme/data"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe("getTodayViews", () => {
    test("returns views for today", () => {
      const analytics = makeAnalytics({
        dailyViews: [
          { date: today, count: 42, uniques: 10 },
          { date: "2025-01-01", count: 100, uniques: 50 },
        ],
      });
      expect(getTodayViews(analytics)).toBe(42);
    });

    test("returns 0 when no data for today", () => {
      const analytics = makeAnalytics({
        dailyViews: [{ date: "2025-01-01", count: 100, uniques: 50 }],
      });
      expect(getTodayViews(analytics)).toBe(0);
    });

    test("returns 0 when dailyViews is empty", () => {
      const analytics = makeAnalytics();
      expect(getTodayViews(analytics)).toBe(0);
    });
  });

  describe("getTodayClicks", () => {
    test("returns clicks for today", () => {
      const analytics = makeAnalytics({
        clicks: [
          { banner_id: "b1", timestamp: `${today}T09:00:00.000Z` },
          { banner_id: "b2", timestamp: `${today}T10:00:00.000Z` },
          { banner_id: "b3", timestamp: "2025-01-01T12:00:00.000Z" },
        ],
      });
      expect(getTodayClicks(analytics)).toBe(2);
    });

    test("returns 0 when no clicks today", () => {
      const analytics = makeAnalytics({
        clicks: [{ banner_id: "b1", timestamp: "2025-01-01T12:00:00.000Z" }],
      });
      expect(getTodayClicks(analytics)).toBe(0);
    });

    test("returns 0 when clicks is empty", () => {
      const analytics = makeAnalytics();
      expect(getTodayClicks(analytics)).toBe(0);
    });
  });

  describe("formatRecap", () => {
    test("formats recap with all data", () => {
      const output = formatRecap(25, 3, 5, 200, 1000, 50);
      expect(output).toContain("=== BidMe: Daily Recap ===");
      expect(output).toContain("Views:  25");
      expect(output).toContain("Clicks: 3");
      expect(output).toContain("Views:  1000");
      expect(output).toContain("Clicks: 50");
      expect(output).toContain("Active Bids: 5");
      expect(output).toContain("Highest Bid:  $200");
      expect(output).toContain("=== End Daily Recap ===");
    });

    test("shows dash when no highest bid", () => {
      const output = formatRecap(0, 0, 0, null, 0, 0);
      expect(output).toContain("Highest Bid:  —");
    });

    test("shows zero values correctly", () => {
      const output = formatRecap(0, 0, 0, null, 0, 0);
      expect(output).toContain("Views:  0");
      expect(output).toContain("Clicks: 0");
      expect(output).toContain("Active Bids: 0");
    });
  });

  describe("runDailyRecap", () => {
    test("succeeds with empty analytics and no period data", async () => {
      const analytics = makeAnalytics();
      await Bun.write(
        join(tempDir, ".bidme/data/analytics.json"),
        JSON.stringify(analytics),
      );

      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
      expect(result.message).toBe("Daily recap generated");
    });

    test("succeeds with analytics data", async () => {
      const analytics = makeAnalytics({
        totalViews: 500,
        dailyViews: [{ date: today, count: 30, uniques: 15 }],
        clicks: [
          { banner_id: "b1", timestamp: `${today}T09:00:00.000Z` },
        ],
      });
      await Bun.write(
        join(tempDir, ".bidme/data/analytics.json"),
        JSON.stringify(analytics),
      );

      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
    });

    test("includes bid info when period data exists", async () => {
      const analytics = makeAnalytics({ totalViews: 100 });
      await Bun.write(
        join(tempDir, ".bidme/data/analytics.json"),
        JSON.stringify(analytics),
      );

      const periodData = makePeriodData([
        makeBid({ amount: 150, status: "approved" }),
        makeBid({ amount: 200, status: "pending", comment_id: 1002 }),
        makeBid({ amount: 50, status: "rejected", comment_id: 1003 }),
      ]);
      await Bun.write(
        join(tempDir, ".bidme/data/current-period.json"),
        JSON.stringify(periodData),
      );

      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
    });

    test("handles missing analytics file gracefully", async () => {
      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
    });

    test("handles closed period data", async () => {
      const analytics = makeAnalytics();
      await Bun.write(
        join(tempDir, ".bidme/data/analytics.json"),
        JSON.stringify(analytics),
      );

      const periodData = makePeriodData([makeBid({ amount: 100 })]);
      periodData.status = "closed";
      await Bun.write(
        join(tempDir, ".bidme/data/current-period.json"),
        JSON.stringify(periodData),
      );

      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
    });

    test("handles corrupt period data gracefully", async () => {
      const analytics = makeAnalytics();
      await Bun.write(
        join(tempDir, ".bidme/data/analytics.json"),
        JSON.stringify(analytics),
      );
      await Bun.write(
        join(tempDir, ".bidme/data/current-period.json"),
        "not valid json{{{",
      );

      const result = await runDailyRecap({ target: tempDir });
      expect(result.success).toBe(true);
    });
  });
});
