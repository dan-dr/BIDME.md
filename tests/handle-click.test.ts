import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { handleClick } from "../scripts/handle-click.ts";
import { loadAnalytics, saveAnalytics } from "../scripts/utils/analytics-store.ts";
import type { AnalyticsData } from "../scripts/utils/analytics-store.ts";

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

describe("handleClick", () => {
  let originalCwd: string;
  let originalEnv: Record<string, string | undefined>;
  let testDir: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  beforeEach(async () => {
    testDir = await mkdtemp(resolve(tmpdir(), "bidme-click-test-"));
    originalEnv = {
      CLIENT_PAYLOAD: process.env["CLIENT_PAYLOAD"],
    };
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    await rm(testDir, { recursive: true });
  });

  test("returns failure when no payload is provided", async () => {
    delete process.env["CLIENT_PAYLOAD"];
    const result = await handleClick();
    expect(result.success).toBe(false);
    expect(result.message).toContain("No click payload");
  });

  test("returns failure for invalid JSON payload", async () => {
    process.env["CLIENT_PAYLOAD"] = "not json {{{";
    const result = await handleClick();
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid click payload");
  });

  test("records click with full payload", async () => {
    const analyticsPath = resolve(testDir, "data", "analytics.json");
    await saveAnalytics(makeAnalytics(), analyticsPath);

    process.env["CLIENT_PAYLOAD"] = JSON.stringify({
      banner_id: "banner-42",
      timestamp: "2026-02-01T12:00:00Z",
      referrer: "user/repo",
    });

    const result = await handleClick();
    expect(result.success).toBe(true);
    expect(result.message).toContain("banner-42");
    expect(result.message).toContain("user/repo");

    const analytics = await loadAnalytics(analyticsPath);
    expect(analytics.clicks).toHaveLength(1);
    expect(analytics.clicks[0]!.banner_id).toBe("banner-42");
    expect(analytics.clicks[0]!.timestamp).toBe("2026-02-01T12:00:00Z");
    expect(analytics.clicks[0]!.referrer).toBe("user/repo");
  });

  test("records click with minimal payload (defaults)", async () => {
    const analyticsPath = resolve(testDir, "data", "analytics.json");
    await saveAnalytics(makeAnalytics(), analyticsPath);

    process.env["CLIENT_PAYLOAD"] = JSON.stringify({});

    const result = await handleClick();
    expect(result.success).toBe(true);

    const analytics = await loadAnalytics(analyticsPath);
    expect(analytics.clicks).toHaveLength(1);
    expect(analytics.clicks[0]!.banner_id).toBe("unknown");
    expect(analytics.clicks[0]!.timestamp).toBeDefined();
  });

  test("appends to existing clicks", async () => {
    const analyticsPath = resolve(testDir, "data", "analytics.json");
    await saveAnalytics(
      makeAnalytics({
        clicks: [{ banner_id: "old-banner", timestamp: "2026-01-01T00:00:00Z" }],
      }),
      analyticsPath,
    );

    process.env["CLIENT_PAYLOAD"] = JSON.stringify({
      banner_id: "new-banner",
      timestamp: "2026-02-01T00:00:00Z",
    });

    const result = await handleClick();
    expect(result.success).toBe(true);

    const analytics = await loadAnalytics(analyticsPath);
    expect(analytics.clicks).toHaveLength(2);
    expect(analytics.clicks[0]!.banner_id).toBe("old-banner");
    expect(analytics.clicks[1]!.banner_id).toBe("new-banner");
  });

  test("creates analytics file if it does not exist", async () => {
    process.env["CLIENT_PAYLOAD"] = JSON.stringify({
      banner_id: "first-click",
      timestamp: "2026-02-01T00:00:00Z",
    });

    const result = await handleClick();
    expect(result.success).toBe(true);

    const analyticsPath = resolve(testDir, "data", "analytics.json");
    const analytics = await loadAnalytics(analyticsPath);
    expect(analytics.clicks).toHaveLength(1);
    expect(analytics.clicks[0]!.banner_id).toBe("first-click");
  });
});
