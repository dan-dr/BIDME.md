import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import {
  loadBidders,
  saveBidders,
  registerBidder,
  markPaymentLinked,
  setWarnedAt,
  resetRegistryCache,
} from "../../lib/bidder-registry.js";
import { DEFAULT_CONFIG, generateToml } from "../../lib/config.js";
import type { BidMeConfig } from "../../lib/config.js";
import type { PeriodData, BidRecord } from "../../lib/types.js";

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
    issue_node_id: "I_abc123",
  };
}

function makeBid(overrides: Partial<BidRecord> = {}): BidRecord {
  return {
    bidder: "bidder1",
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    contact: "bid@example.com",
    status: "pending",
    comment_id: 1001,
    timestamp: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

function mockFetchForGitHub(overrides: Record<string, any> = {}) {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; method: string; body?: string }[] = [];

  globalThis.fetch = mock(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body });

    if (url.includes("/comments/") && method === "GET") {
      const commentId = url.match(/\/comments\/(\d+)/)?.[1];
      const commentOverride = overrides.comments?.[commentId];
      return new Response(
        JSON.stringify(
          commentOverride ?? {
            id: parseInt(commentId ?? "1001"),
            body: "```yaml\namount: 100\nbanner_url: https://example.com/banner.png\n```",
            user: { login: "bidder1" },
            created_at: "",
          },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/comments/") && method === "PATCH") {
      return new Response(
        JSON.stringify({ id: 1001, body: "", user: { login: "bidder1" }, created_at: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/comments") && method === "POST") {
      return new Response(
        JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/issues/") && method === "PATCH") {
      return new Response(
        JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  return { originalFetch, calls };
}

describe("check-grace command", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-grace-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_test_token_fake";
  });

  afterEach(async () => {
    resetRegistryCache();
    await rm(tempDir, { recursive: true });
    process.env = { ...originalEnv };
    mock.restore();
  });

  test("returns success when no active period exists", async () => {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(join(tempDir, ".bidme/data/current-period.json"));
    } catch {}

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("No active bidding period");
  });

  test("returns success when period is closed", async () => {
    const periodData = makePeriodData();
    periodData.status = "closed";
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("not open");
  });

  test("returns success when no unlinked_pending bids exist", async () => {
    const bids = [makeBid({ status: "approved" }), makeBid({ bidder: "b2", status: "pending", comment_id: 1002 })];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("No unlinked_pending bids");
  });

  test("restores bid when bidder has since linked payment", async () => {
    const bids = [
      makeBid({ bidder: "alice", status: "unlinked_pending", comment_id: 1001 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("alice");
    markPaymentLinked("alice", "polar");
    setWarnedAt("alice", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub({
      comments: {
        "1001": {
          id: 1001,
          body: "~~original bid content~~",
          user: { login: "alice" },
          created_at: "",
        },
      },
    });

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 restored");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    const aliceBid = saved.bids.find((b) => b.bidder === "alice");
    expect(aliceBid).toBeDefined();
    expect(aliceBid!.status).not.toBe("unlinked_pending");

    globalThis.fetch = originalFetch;
  });

  test("restores bid to 'approved' in auto-approve mode", async () => {
    const autoConfig: BidMeConfig = {
      ...DEFAULT_CONFIG,
      approval: { ...DEFAULT_CONFIG.approval, mode: "auto" },
    };
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(autoConfig));

    const bids = [
      makeBid({ bidder: "alice", status: "unlinked_pending", comment_id: 1001 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("alice");
    markPaymentLinked("alice", "polar");
    setWarnedAt("alice", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("approved");

    globalThis.fetch = originalFetch;
  });

  test("restores bid to 'pending' in emoji mode", async () => {
    const emojiConfig: BidMeConfig = {
      ...DEFAULT_CONFIG,
      approval: { ...DEFAULT_CONFIG.approval, mode: "emoji" },
    };
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(emojiConfig));

    const bids = [
      makeBid({ bidder: "bob", status: "unlinked_pending", comment_id: 1002 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("bob");
    markPaymentLinked("bob", "stripe");
    setWarnedAt("bob", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("pending");

    globalThis.fetch = originalFetch;
  });

  test("expires bid when grace period has passed and bidder still unlinked", async () => {
    const pastWarned = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "charlie", status: "unlinked_pending", comment_id: 1003 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("charlie");
    setWarnedAt("charlie", pastWarned);
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 expired");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("expired");

    globalThis.fetch = originalFetch;
  });

  test("leaves bid as unlinked_pending when still within grace period", async () => {
    const recentWarned = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "dave", status: "unlinked_pending", comment_id: 1004 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("dave");
    setWarnedAt("dave", recentWarned);
    await saveBidders(tempDir);
    resetRegistryCache();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 still pending");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("unlinked_pending");
  });

  test("handles mixed scenarios: some linked, some expired, some pending", async () => {
    const pastWarned = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recentWarned = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "alice", status: "unlinked_pending", comment_id: 1001, amount: 100 }),
      makeBid({ bidder: "bob", status: "unlinked_pending", comment_id: 1002, amount: 150 }),
      makeBid({ bidder: "charlie", status: "unlinked_pending", comment_id: 1003, amount: 200 }),
      makeBid({ bidder: "approved-bidder", status: "approved", comment_id: 1004, amount: 50 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("alice");
    markPaymentLinked("alice", "polar");
    setWarnedAt("alice", pastWarned);

    registerBidder("bob");
    setWarnedAt("bob", pastWarned);

    registerBidder("charlie");
    setWarnedAt("charlie", recentWarned);

    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 restored");
    expect(result.message).toContain("1 expired");
    expect(result.message).toContain("1 still pending");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );

    const alice = saved.bids.find((b) => b.bidder === "alice");
    expect(alice!.status).not.toBe("unlinked_pending");

    const bob = saved.bids.find((b) => b.bidder === "bob");
    expect(bob!.status).toBe("expired");

    const charlie = saved.bids.find((b) => b.bidder === "charlie");
    expect(charlie!.status).toBe("unlinked_pending");

    const approvedBidder = saved.bids.find((b) => b.bidder === "approved-bidder");
    expect(approvedBidder!.status).toBe("approved");

    globalThis.fetch = originalFetch;
  });

  test("posts restore comment via GitHub API when bidder links payment", async () => {
    const bids = [
      makeBid({ bidder: "alice", status: "unlinked_pending", comment_id: 1001 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("alice");
    markPaymentLinked("alice", "polar");
    setWarnedAt("alice", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch, calls } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    await runCheckGrace({ target: tempDir });

    const postCalls = calls.filter((c) => c.method === "POST" && c.url.includes("/comments"));
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const body = postCalls[0]!.body;
    expect(body).toContain("Payment linked");
    expect(body).toContain("alice");

    globalThis.fetch = originalFetch;
  });

  test("posts expiry comment via GitHub API when grace period expires", async () => {
    const pastWarned = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "bob", status: "unlinked_pending", comment_id: 1002 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("bob");
    setWarnedAt("bob", pastWarned);
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch, calls } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    await runCheckGrace({ target: tempDir });

    const postCalls = calls.filter((c) => c.method === "POST" && c.url.includes("/comments"));
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const body = postCalls[0]!.body;
    expect(body).toContain("removed");
    expect(body).toContain("expired");

    globalThis.fetch = originalFetch;
  });

  test("works without GitHub env vars (local mode)", async () => {
    delete process.env["GITHUB_REPOSITORY_OWNER"];
    delete process.env["GITHUB_REPOSITORY"];

    const pastWarned = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "eve", status: "unlinked_pending", comment_id: 1005 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("eve");
    setWarnedAt("eve", pastWarned);
    await saveBidders(tempDir);
    resetRegistryCache();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 expired");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("expired");
  });

  test("un-strikethroughs comment when restoring bid", async () => {
    const bids = [
      makeBid({ bidder: "frank", status: "unlinked_pending", comment_id: 1006 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(
      join(tempDir, ".bidme/data/current-period.json"),
      JSON.stringify(periodData),
    );

    await loadBidders(tempDir);
    registerBidder("frank");
    markPaymentLinked("frank", "polar");
    setWarnedAt("frank", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch, calls } = mockFetchForGitHub({
      comments: {
        "1006": {
          id: 1006,
          body: "~~original bid~~",
          user: { login: "frank" },
          created_at: "",
        },
      },
    });

    const { runCheckGrace } = await import("../check-grace.js");
    await runCheckGrace({ target: tempDir });

    const patchCalls = calls.filter((c) => c.method === "PATCH" && c.url.includes("/comments/"));
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const patchBody = JSON.parse(patchCalls[0]!.body!);
    expect(patchBody.body).toBe("original bid");

    globalThis.fetch = originalFetch;
  });
});
