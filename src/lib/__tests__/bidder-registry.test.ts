import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import {
  loadBidders,
  saveBidders,
  getBidder,
  registerBidder,
  markPaymentLinked,
  isPaymentLinked,
  getGraceDeadline,
  setWarnedAt,
  resetRegistryCache,
} from "../bidder-registry.js";

describe("bidder-registry", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-bidder-test-"));
    await Bun.write(
      join(tempDir, ".bidme", "data", "bidders.json"),
      JSON.stringify({ bidders: {} }, null, 2),
    );
    resetRegistryCache();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    resetRegistryCache();
  });

  async function ensureDataDir() {
    const { mkdir } = await import("fs/promises");
    await mkdir(join(tempDir, ".bidme", "data"), { recursive: true });
  }

  describe("registerBidder", () => {
    test("creates new bidder with payment_linked false", async () => {
      await loadBidders(tempDir);
      const record = registerBidder("alice");
      expect(record.github_username).toBe("alice");
      expect(record.payment_linked).toBe(false);
      expect(record.stripe_customer_id).toBeUndefined();
      expect(record.stripe_payment_method_id).toBeUndefined();
      expect(record.linked_at).toBeNull();
      expect(record.warned_at).toBeNull();
    });

    test("returns existing bidder if already registered", async () => {
      await loadBidders(tempDir);
      const first = registerBidder("alice");
      first.payment_linked = true;
      const second = registerBidder("alice");
      expect(second.payment_linked).toBe(true);
    });
  });

  describe("getBidder", () => {
    test("returns null for unknown bidder", async () => {
      await loadBidders(tempDir);
      expect(getBidder("unknown")).toBeNull();
    });

    test("returns registered bidder", async () => {
      await loadBidders(tempDir);
      registerBidder("bob");
      const record = getBidder("bob");
      expect(record).not.toBeNull();
      expect(record!.github_username).toBe("bob");
    });
  });

  describe("isPaymentLinked", () => {
    test("returns false for unknown bidder", async () => {
      await loadBidders(tempDir);
      expect(isPaymentLinked("unknown")).toBe(false);
    });

    test("returns false for unlinked bidder", async () => {
      await loadBidders(tempDir);
      registerBidder("charlie");
      expect(isPaymentLinked("charlie")).toBe(false);
    });

    test("returns true after marking payment linked", async () => {
      await loadBidders(tempDir);
      registerBidder("charlie");
      markPaymentLinked("charlie", "cus_charlie123", "pm_charlie456");
      expect(isPaymentLinked("charlie")).toBe(true);
    });
  });

  describe("markPaymentLinked", () => {
    test("updates payment status and stores Stripe IDs", async () => {
      await loadBidders(tempDir);
      registerBidder("dave");
      markPaymentLinked("dave", "cus_dave123", "pm_dave456");
      const record = getBidder("dave");
      expect(record!.payment_linked).toBe(true);
      expect(record!.stripe_customer_id).toBe("cus_dave123");
      expect(record!.stripe_payment_method_id).toBe("pm_dave456");
      expect(record!.linked_at).not.toBeNull();
    });

    test("auto-registers bidder if not yet registered", async () => {
      await loadBidders(tempDir);
      markPaymentLinked("newuser", "cus_new123", "pm_new456");
      const record = getBidder("newuser");
      expect(record).not.toBeNull();
      expect(record!.payment_linked).toBe(true);
      expect(record!.stripe_customer_id).toBe("cus_new123");
      expect(record!.stripe_payment_method_id).toBe("pm_new456");
    });
  });

  describe("grace period", () => {
    test("returns null when no warned_at set", async () => {
      await loadBidders(tempDir);
      registerBidder("eve");
      expect(getGraceDeadline("eve", 24)).toBeNull();
    });

    test("calculates deadline from warned_at + graceHours", async () => {
      await loadBidders(tempDir);
      registerBidder("eve");
      const warnTime = "2026-02-01T12:00:00.000Z";
      setWarnedAt("eve", warnTime);

      const deadline = getGraceDeadline("eve", 24);
      expect(deadline).not.toBeNull();
      expect(deadline!.toISOString()).toBe("2026-02-02T12:00:00.000Z");
    });

    test("handles fractional grace hours", async () => {
      await loadBidders(tempDir);
      registerBidder("frank");
      const warnTime = "2026-02-01T12:00:00.000Z";
      setWarnedAt("frank", warnTime);

      const deadline = getGraceDeadline("frank", 0.5);
      expect(deadline).not.toBeNull();
      expect(deadline!.toISOString()).toBe("2026-02-01T12:30:00.000Z");
    });

    test("returns null for unknown bidder", async () => {
      await loadBidders(tempDir);
      expect(getGraceDeadline("nobody", 24)).toBeNull();
    });
  });

  describe("persistence", () => {
    test("saves and loads bidders to/from JSON file", async () => {
      await ensureDataDir();
      await loadBidders(tempDir);
      registerBidder("alice");
      markPaymentLinked("alice", "cus_alice123", "pm_alice456");
      registerBidder("bob");
      setWarnedAt("bob", "2026-02-01T00:00:00.000Z");
      await saveBidders(tempDir);

      resetRegistryCache();
      await loadBidders(tempDir);

      const alice = getBidder("alice");
      expect(alice).not.toBeNull();
      expect(alice!.payment_linked).toBe(true);
      expect(alice!.stripe_customer_id).toBe("cus_alice123");
      expect(alice!.stripe_payment_method_id).toBe("pm_alice456");

      const bob = getBidder("bob");
      expect(bob).not.toBeNull();
      expect(bob!.payment_linked).toBe(false);
      expect(bob!.warned_at).toBe("2026-02-01T00:00:00.000Z");
    });

    test("loads empty registry when file does not exist", async () => {
      const emptyDir = await mkdtemp(resolve(tmpdir(), "bidme-empty-test-"));
      await loadBidders(emptyDir);
      expect(getBidder("anyone")).toBeNull();
      registerBidder("newbie");
      expect(getBidder("newbie")).not.toBeNull();
      await rm(emptyDir, { recursive: true });
    });

    test("persisted file is valid JSON", async () => {
      await ensureDataDir();
      await loadBidders(tempDir);
      registerBidder("test");
      await saveBidders(tempDir);

      const filePath = join(tempDir, ".bidme", "data", "bidders.json");
      const content = await Bun.file(filePath).text();
      const parsed = JSON.parse(content);
      expect(parsed.bidders).toBeDefined();
      expect(parsed.bidders.test).toBeDefined();
      expect(parsed.bidders.test.github_username).toBe("test");
    });
  });
});
