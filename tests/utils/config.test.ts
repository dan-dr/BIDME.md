import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { loadConfig } from "../../scripts/utils/config";
import { resolve } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

describe("loadConfig", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns defaults when file does not exist", async () => {
    const config = await loadConfig(resolve(tempDir, "missing.yml"));
    expect(config.bidding.schedule).toBe("monthly");
    expect(config.bidding.duration).toBe(7);
    expect(config.bidding.minimum_bid).toBe(50);
    expect(config.bidding.increment).toBe(5);
    expect(config.banner.width).toBe(800);
    expect(config.banner.height).toBe(100);
    expect(config.banner.format).toBe("png,jpg,svg");
    expect(config.banner.max_size).toBe(200);
    expect(config.banner.position).toBe("top");
    expect(config.content_guidelines.prohibited).toEqual([
      "adult content",
      "gambling",
      "misleading claims",
    ]);
    expect(config.content_guidelines.required).toEqual([
      "alt text",
      "clear branding",
    ]);
    expect(config.analytics.display).toBe(true);
    expect(config.analytics.metrics).toEqual([
      "views",
      "countries",
      "referrers",
      "clicks",
    ]);
  });

  test("loads project bidme-config.yml", async () => {
    const config = await loadConfig(
      resolve(import.meta.dir, "../../bidme-config.yml"),
    );
    expect(config.bidding.schedule).toBe("monthly");
    expect(config.bidding.minimum_bid).toBe(50);
    expect(config.banner.position).toBe("top");
    expect(config.analytics.display).toBe(true);
  });

  test("merges partial overrides with defaults", async () => {
    const partialPath = resolve(tempDir, "partial.yml");
    await Bun.write(
      partialPath,
      `bidding:\n  minimum_bid: 100\n  schedule: "weekly"\n`,
    );
    const config = await loadConfig(partialPath);
    expect(config.bidding.minimum_bid).toBe(100);
    expect(config.bidding.schedule).toBe("weekly");
    expect(config.bidding.duration).toBe(7);
    expect(config.bidding.increment).toBe(5);
    expect(config.banner.width).toBe(800);
  });

  test("returns defaults for empty file", async () => {
    const emptyPath = resolve(tempDir, "empty.yml");
    await Bun.write(emptyPath, "");
    const config = await loadConfig(emptyPath);
    expect(config.bidding.schedule).toBe("monthly");
    expect(config.banner.width).toBe(800);
  });

  test("overrides array values entirely", async () => {
    const arrPath = resolve(tempDir, "arrays.yml");
    await Bun.write(
      arrPath,
      `content_guidelines:\n  prohibited:\n    - "spam"\n`,
    );
    const config = await loadConfig(arrPath);
    expect(config.content_guidelines.prohibited).toEqual(["spam"]);
    expect(config.content_guidelines.required).toEqual([
      "alt text",
      "clear branding",
    ]);
  });
});
