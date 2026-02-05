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
  resetRegistryCache,
  getBidder,
  setWarnedAt,
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

function makeStrictConfig(): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    enforcement: {
      require_payment_before_bid: true,
      strikethrough_unlinked: true,
    },
    payment: {
      ...DEFAULT_CONFIG.payment,
      allow_unlinked_bids: false,
    },
  };
}

function makeLenientConfig(): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    enforcement: {
      require_payment_before_bid: false,
      strikethrough_unlinked: false,
    },
    payment: {
      ...DEFAULT_CONFIG.payment,
      allow_unlinked_bids: true,
    },
  };
}

const ISSUE_BODY_STUB = `## 🏷️ Banner Sponsorship — monthly Bidding Period

### 🔝 Current Top Bid

No bids yet

### Rules
- **Minimum bid:** $50

### Bid Table

| Rank | Bidder | Amount | Status | Banner Preview |
|------|--------|--------|--------|----------------|
| — | No bids yet | — | — | — |

### How to Bid

Post a comment with the following format:

### Deadline

**Friday, February 8, 2026** — 6 days remaining`;

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
            body: "```yaml\namount: 100\nbanner_url: https://example.com/banner.png\ndestination_url: https://example.com\ncontact: bid@example.com\n```",
            user: { login: "bidder1" },
            created_at: "2026-02-02T10:00:00.000Z",
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

    if (url.includes("/issues/") && method === "GET") {
      return new Response(
        JSON.stringify(
          overrides.issue ?? {
            number: 42,
            body: ISSUE_BODY_STUB,
            html_url: "https://github.com/testowner/testrepo/issues/42",
            title: "BidMe: Banner Bidding",
            state: "open",
            node_id: "I_abc123",
          },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
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

// ─── Strict Mode: Unlinked Bidder ────────────────────────────────────────────

describe("payment enforcement: strict mode", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-enforce-strict-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    const config = makeStrictConfig();
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(config));
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

  test("unlinked bidder gets bid status set to 'unlinked_pending'", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("paused");
    expect(result.message).toContain("payment not linked");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids.length).toBe(1);
    expect(saved.bids[0]!.status).toBe("unlinked_pending");

    globalThis.fetch = originalFetch;
  });

  test("unlinked bidder's comment gets strikethrough", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch, calls } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    await runProcessBid(42, 1001, { target: tempDir });

    const patchCalls = calls.filter((c) => c.method === "PATCH" && c.url.includes("/comments/"));
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const patchBody = JSON.parse(patchCalls[0]!.body!);
    expect(patchBody.body).toContain("~~");

    globalThis.fetch = originalFetch;
  });

  test("unlinked bidder gets a warning comment posted", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch, calls } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    await runProcessBid(42, 1001, { target: tempDir });

    const postCalls = calls.filter((c) => c.method === "POST" && c.url.includes("/comments"));
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const commentBody = JSON.parse(postCalls[0]!.body!).body;
    expect(commentBody).toContain("paused");
    expect(commentBody).toContain("link your payment method");
    expect(commentBody).toContain("@bidder1");

    globalThis.fetch = originalFetch;
  });

  test("warned_at timestamp is set for unlinked bidder", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    await runProcessBid(42, 1001, { target: tempDir });

    resetRegistryCache();
    await loadBidders(tempDir);
    const bidder = getBidder("bidder1");
    expect(bidder).not.toBeNull();
    expect(bidder!.warned_at).not.toBeNull();

    globalThis.fetch = originalFetch;
  });

  test("linked bidder's bid proceeds normally in strict mode", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    await loadBidders(tempDir);
    registerBidder("bidder1");
    markPaymentLinked("bidder1", "polar");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("accepted");
    expect(result.message).not.toContain("paused");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids.length).toBe(1);
    expect(saved.bids[0]!.status).not.toBe("unlinked_pending");

    globalThis.fetch = originalFetch;
  });
});

// ─── Lenient Mode: Unlinked Bidder ───────────────────────────────────────────

describe("payment enforcement: lenient mode", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-enforce-lenient-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    const config = makeLenientConfig();
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(config));
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

  test("unlinked bidder's bid is accepted with warning in lenient mode", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch, calls } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("accepted");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids.length).toBe(1);
    expect(saved.bids[0]!.status).not.toBe("unlinked_pending");

    const postCalls = calls.filter((c) => c.method === "POST" && c.url.includes("/comments"));
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const commentBody = JSON.parse(postCalls[0]!.body!).body;
    expect(commentBody).toContain("haven't linked a payment method");

    globalThis.fetch = originalFetch;
  });

  test("bid status is 'pending' in lenient emoji mode for unlinked bidder", async () => {
    const lenientEmojiConfig: BidMeConfig = {
      ...makeLenientConfig(),
      approval: { ...DEFAULT_CONFIG.approval, mode: "emoji" },
    };
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(lenientEmojiConfig));

    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("pending");

    globalThis.fetch = originalFetch;
  });

  test("bid status is 'approved' in lenient auto mode for unlinked bidder", async () => {
    const lenientAutoConfig: BidMeConfig = {
      ...makeLenientConfig(),
      approval: { ...DEFAULT_CONFIG.approval, mode: "auto" },
    };
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(lenientAutoConfig));

    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { originalFetch } = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    expect(saved.bids[0]!.status).toBe("approved");

    globalThis.fetch = originalFetch;
  });
});

// ─── Grace Period: Expiry and Restoration ────────────────────────────────────

describe("payment enforcement: grace period", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-enforce-grace-"));
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

  test("grace period expiry removes bid (sets status to 'expired')", async () => {
    const pastWarned = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const bids = [
      makeBid({ bidder: "alice", status: "unlinked_pending", comment_id: 1001 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    await loadBidders(tempDir);
    registerBidder("alice");
    setWarnedAt("alice", pastWarned);
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

  test("grace period completion restores bid when payment linked", async () => {
    const bids = [
      makeBid({ bidder: "bob", status: "unlinked_pending", comment_id: 1002 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    await loadBidders(tempDir);
    registerBidder("bob");
    markPaymentLinked("bob", "polar");
    setWarnedAt("bob", "2026-02-01T00:00:00.000Z");
    await saveBidders(tempDir);
    resetRegistryCache();

    const { originalFetch } = mockFetchForGitHub();

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("1 restored");

    const saved: PeriodData = JSON.parse(
      await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text(),
    );
    const bobBid = saved.bids.find((b) => b.bidder === "bob");
    expect(bobBid).toBeDefined();
    expect(bobBid!.status).not.toBe("unlinked_pending");
    expect(bobBid!.status).not.toBe("expired");

    globalThis.fetch = originalFetch;
  });
});
