import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import {
  loadConfig,
  saveConfig,
  validateConfig,
  generateToml,
  parseToml,
  DEFAULT_CONFIG,
  ConfigValidationError,
} from "../config.js";
import type { BidMeConfig } from "../config.js";

describe("TOML config system", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-config-test-"));
    await mkdir(join(tempDir, ".bidme"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe("loadConfig", () => {
    test("loads a valid .bidme/config.toml file", async () => {
      const toml = generateToml(DEFAULT_CONFIG);
      await Bun.write(join(tempDir, ".bidme", "config.toml"), toml);

      const config = await loadConfig(tempDir);

      expect(config.bidding.schedule).toBe("monthly");
      expect(config.bidding.duration).toBe(7);
      expect(config.bidding.minimum_bid).toBe(50);
      expect(config.bidding.increment).toBe(5);
      expect(config.banner.width).toBe(800);
      expect(config.banner.formats).toEqual(["png", "jpg", "svg"]);
      expect(config.approval.mode).toBe("emoji");
      expect(config.payment.provider).toBe("polar-own");
      expect(config.enforcement.require_payment_before_bid).toBe(true);
      expect(config.tracking.append_utm).toBe(true);
      expect(config.tracking.utm_params).toBe("source=bidme&repo={owner}/{repo}");
      expect(config.content_guidelines.prohibited).toEqual([
        "adult content",
        "gambling",
        "misleading claims",
      ]);
    });

    test("deep-merges partial config with defaults for missing sections", async () => {
      const partialToml = `[bidding]
schedule = "weekly"
duration = 14
minimum_bid = 100
increment = 10
`;
      await Bun.write(join(tempDir, ".bidme", "config.toml"), partialToml);

      const config = await loadConfig(tempDir);

      expect(config.bidding.schedule).toBe("weekly");
      expect(config.bidding.duration).toBe(14);
      expect(config.bidding.minimum_bid).toBe(100);
      expect(config.bidding.increment).toBe(10);

      expect(config.banner.width).toBe(DEFAULT_CONFIG.banner.width);
      expect(config.banner.height).toBe(DEFAULT_CONFIG.banner.height);
      expect(config.banner.formats).toEqual(DEFAULT_CONFIG.banner.formats);
      expect(config.approval.mode).toBe(DEFAULT_CONFIG.approval.mode);
      expect(config.payment.provider).toBe(DEFAULT_CONFIG.payment.provider);
      expect(config.enforcement.require_payment_before_bid).toBe(
        DEFAULT_CONFIG.enforcement.require_payment_before_bid,
      );
      expect(config.tracking.append_utm).toBe(DEFAULT_CONFIG.tracking.append_utm);
      expect(config.content_guidelines.prohibited).toEqual(
        DEFAULT_CONFIG.content_guidelines.prohibited,
      );
    });

    test("returns all defaults when no config file exists", async () => {
      const emptyDir = await mkdtemp(resolve(tmpdir(), "bidme-no-config-"));
      try {
        const config = await loadConfig(emptyDir);
        expect(config).toEqual(DEFAULT_CONFIG);
      } finally {
        await rm(emptyDir, { recursive: true });
      }
    });
  });

  describe("saveConfig and round-trip", () => {
    test("save and re-load round-trips correctly", async () => {
      const customConfig: BidMeConfig = {
        bidding: {
          schedule: "weekly",
          duration: 14,
          minimum_bid: 100,
          increment: 10,
        },
        banner: {
          width: 1200,
          height: 200,
          formats: ["png", "webp"],
          max_size: 500,
        },
        approval: {
          mode: "auto",
          allowed_reactions: ["👍", "🎉"],
        },
        payment: {
          provider: "bidme-managed",
          allow_unlinked_bids: true,
          unlinked_grace_hours: 48,
          payment_link: "https://custom.dev/pay",
        },
        enforcement: {
          require_payment_before_bid: false,
          strikethrough_unlinked: false,
        },
        tracking: {
          append_utm: false,
          utm_params: "source=custom",
        },
        content_guidelines: {
          prohibited: ["spam"],
          required: ["logo"],
        },
      };

      await saveConfig(customConfig, tempDir);
      const loaded = await loadConfig(tempDir);

      expect(loaded.bidding.schedule).toBe("weekly");
      expect(loaded.bidding.duration).toBe(14);
      expect(loaded.bidding.minimum_bid).toBe(100);
      expect(loaded.bidding.increment).toBe(10);
      expect(loaded.banner.width).toBe(1200);
      expect(loaded.banner.height).toBe(200);
      expect(loaded.banner.formats).toEqual(["png", "webp"]);
      expect(loaded.banner.max_size).toBe(500);
      expect(loaded.approval.mode).toBe("auto");
      expect(loaded.approval.allowed_reactions).toEqual(["👍", "🎉"]);
      expect(loaded.payment.provider).toBe("bidme-managed");
      expect(loaded.payment.allow_unlinked_bids).toBe(true);
      expect(loaded.payment.unlinked_grace_hours).toBe(48);
      expect(loaded.enforcement.require_payment_before_bid).toBe(false);
      expect(loaded.enforcement.strikethrough_unlinked).toBe(false);
      expect(loaded.tracking.append_utm).toBe(false);
      expect(loaded.tracking.utm_params).toBe("source=custom");
      expect(loaded.content_guidelines.prohibited).toEqual(["spam"]);
      expect(loaded.content_guidelines.required).toEqual(["logo"]);
    });
  });

  describe("validateConfig", () => {
    test("rejects non-object config", () => {
      expect(() => validateConfig(null)).toThrow(ConfigValidationError);
      expect(() => validateConfig(undefined)).toThrow(ConfigValidationError);
      expect(() => validateConfig("string")).toThrow(ConfigValidationError);
    });

    test("rejects negative bid amounts", () => {
      expect(() =>
        validateConfig({
          bidding: { minimum_bid: -10 },
        }),
      ).toThrow("bidding.minimum_bid must be a non-negative number");
    });

    test("rejects zero or negative duration", () => {
      expect(() =>
        validateConfig({
          bidding: { duration: 0 },
        }),
      ).toThrow("bidding.duration must be a positive number");

      expect(() =>
        validateConfig({
          bidding: { duration: -5 },
        }),
      ).toThrow("bidding.duration must be a positive number");
    });

    test("rejects negative increment", () => {
      expect(() =>
        validateConfig({
          bidding: { increment: -1 },
        }),
      ).toThrow("bidding.increment must be a non-negative number");
    });

    test("rejects invalid schedule strings", () => {
      expect(() =>
        validateConfig({
          bidding: { schedule: "daily" },
        }),
      ).toThrow("bidding.schedule must be one of: weekly, monthly");
    });

    test("rejects invalid approval mode", () => {
      expect(() =>
        validateConfig({
          approval: { mode: "manual" },
        }),
      ).toThrow("approval.mode must be one of: auto, emoji");
    });

    test("rejects invalid payment provider", () => {
      expect(() =>
        validateConfig({
          payment: { provider: "stripe" },
        }),
      ).toThrow("payment.provider must be one of: polar-own, bidme-managed");
    });

    test("rejects negative unlinked_grace_hours", () => {
      expect(() =>
        validateConfig({
          payment: { unlinked_grace_hours: -1 },
        }),
      ).toThrow("payment.unlinked_grace_hours must be a non-negative number");
    });

    test("rejects invalid banner dimensions", () => {
      expect(() =>
        validateConfig({
          banner: { width: 0 },
        }),
      ).toThrow("banner.width must be a positive number");

      expect(() =>
        validateConfig({
          banner: { height: -10 },
        }),
      ).toThrow("banner.height must be a positive number");

      expect(() =>
        validateConfig({
          banner: { max_size: 0 },
        }),
      ).toThrow("banner.max_size must be a positive number");
    });

    test("accepts valid partial config and fills defaults", () => {
      const result = validateConfig({
        bidding: { schedule: "weekly" },
      });
      expect(result.bidding.schedule).toBe("weekly");
      expect(result.bidding.duration).toBe(DEFAULT_CONFIG.bidding.duration);
      expect(result.banner).toEqual(DEFAULT_CONFIG.banner);
      expect(result.approval).toEqual(DEFAULT_CONFIG.approval);
    });
  });

  describe("generateToml", () => {
    test("TOML comments are preserved in output", () => {
      const toml = generateToml(DEFAULT_CONFIG);

      expect(toml).toContain("# BidMe Configuration");
      expect(toml).toContain("# Bidding schedule and pricing");
      expect(toml).toContain("# Banner display constraints");
      expect(toml).toContain("# Bid approval settings");
      expect(toml).toContain("# Payment configuration");
      expect(toml).toContain("# Enforcement rules");
      expect(toml).toContain("# UTM tracking for bid links");
      expect(toml).toContain("# Content guidelines for banner submissions");
    });

    test("output is valid TOML that can be parsed back", () => {
      const toml = generateToml(DEFAULT_CONFIG);
      const parsed = parseToml(toml);

      expect(parsed.bidding.schedule).toBe(DEFAULT_CONFIG.bidding.schedule);
      expect(parsed.bidding.duration).toBe(DEFAULT_CONFIG.bidding.duration);
      expect(parsed.banner.width).toBe(DEFAULT_CONFIG.banner.width);
      expect(parsed.approval.mode).toBe(DEFAULT_CONFIG.approval.mode);
      expect(parsed.payment.provider).toBe(DEFAULT_CONFIG.payment.provider);
      expect(parsed.enforcement.require_payment_before_bid).toBe(
        DEFAULT_CONFIG.enforcement.require_payment_before_bid,
      );
      expect(parsed.tracking.append_utm).toBe(DEFAULT_CONFIG.tracking.append_utm);
    });
  });
});
