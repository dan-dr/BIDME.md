import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { resetRegistryCache } from "../../lib/bidder-registry.js";
import { DEFAULT_CONFIG, generateToml } from "../../lib/config.js";
import type { BidMeConfig } from "../../lib/config.js";
import type { PeriodData, BidRecord } from "../../lib/types.js";
import { parseBidComment, validateBid } from "../../lib/validation.js";
import {
  generateBidIssueBody,
  updateBidIssueBody,
  generateCurrentTopBid,
  generateBidTable,
} from "../../lib/issue-template.js";
import { appendTrackingParams } from "../close-bidding.js";

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

function makeAutoConfig(): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    approval: { ...DEFAULT_CONFIG.approval, mode: "auto" as const },
    enforcement: { ...DEFAULT_CONFIG.enforcement, require_payment_before_bid: false },
  };
}

function makeEmojiConfig(): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    approval: { ...DEFAULT_CONFIG.approval, mode: "emoji" as const },
    enforcement: { ...DEFAULT_CONFIG.enforcement, require_payment_before_bid: false },
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
  globalThis.fetch = mock(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/comments/") && (!init?.method || init?.method === "GET")) {
      return new Response(
        JSON.stringify(
          overrides.comment ?? {
            id: 1001,
            body: "```yaml\namount: 100\nbanner_url: https://example.com/banner.png\ndestination_url: https://example.com\ncontact: bid@example.com\n```",
            user: { login: "bidder1" },
            created_at: "2026-02-02T10:00:00.000Z",
          },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/issues/") && (!init?.method || init?.method === "GET")) {
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

    if (url.includes("/issues") && init?.method === "POST") {
      return new Response(
        JSON.stringify(
          overrides.createdIssue ?? {
            number: 42,
            html_url: "https://github.com/testowner/testrepo/issues/42",
            node_id: "I_abc123",
            body: "",
            title: "",
            state: "open",
          },
        ),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/issues/") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/comments") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/graphql")) {
      return new Response(
        JSON.stringify({ data: { pinIssue: { issue: { id: "I_abc123" } }, unpinIssue: { issue: { id: "I_abc123" } } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/reactions")) {
      return new Response(JSON.stringify(overrides.reactions ?? []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/contents/")) {
      return new Response(
        JSON.stringify({ content: "", sha: "abc123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!url.includes("api.github.com") && (init?.method === "HEAD" || !init?.method)) {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": "1024",
        },
      });
    }

    return originalFetch(input, init);
  }) as unknown as typeof fetch;
  return originalFetch;
}

// ─── Bid Parsing & Validation ────────────────────────────────────────────────

describe("bid parsing and validation", () => {
  test("parses valid YAML bid comment", () => {
    const body = `I'd like to bid:

\`\`\`yaml
amount: 150
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: user@example.com
\`\`\``;

    const parsed = parseBidComment(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(150);
    expect(parsed!.banner_url).toBe("https://example.com/banner.png");
    expect(parsed!.destination_url).toBe("https://example.com");
    expect(parsed!.contact).toBe("user@example.com");
  });

  test("returns null for comment without YAML block", () => {
    expect(parseBidComment("Just a regular comment")).toBeNull();
  });

  test("returns null when required fields are missing", () => {
    const body = "```yaml\namount: 100\n```";
    expect(parseBidComment(body)).toBeNull();
  });

  test("validates bid amount against minimum_bid config", () => {
    const bid = { amount: 10, banner_url: "https://x.com/b.png", destination_url: "https://x.com", contact: "u@x.com" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "amount" && e.message.includes("at least"))).toBe(true);
  });

  test("validates bid amount increment", () => {
    const bid = { amount: 53, banner_url: "https://x.com/b.png", destination_url: "https://x.com", contact: "u@x.com" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "amount" && e.message.includes("increment"))).toBe(true);
  });

  test("validates URLs are valid http/https", () => {
    const bid = { amount: 100, banner_url: "ftp://x.com/b.png", destination_url: "https://x.com", contact: "u@x.com" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url")).toBe(true);
  });

  test("validates contact is email or github username", () => {
    const bid = { amount: 100, banner_url: "https://x.com/b.png", destination_url: "https://x.com", contact: "not valid" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "contact")).toBe(true);
  });

  test("accepts valid github username as contact", () => {
    const bid = { amount: 100, banner_url: "https://x.com/b.png", destination_url: "https://x.com", contact: "@ghuser" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
  });

  test("passes validation for a fully valid bid", () => {
    const bid = { amount: 100, banner_url: "https://x.com/b.png", destination_url: "https://x.com", contact: "u@x.com" };
    const result = validateBid(bid, DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Process Bid: Auto-approve vs Emoji ──────────────────────────────────────

describe("process-bid: approval modes", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-bidding-test-"));
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

  test("auto-approve mode sets bid status to 'approved' immediately", async () => {
    const autoConfig = makeAutoConfig();
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(autoConfig));

    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("approved");

    const saved: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(saved.bids.length).toBe(1);
    expect(saved.bids[0]!.status).toBe("approved");

    globalThis.fetch = originalFetch;
  });

  test("emoji mode sets bid status to 'pending'", async () => {
    const emojiConfig = makeEmojiConfig();
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(emojiConfig));

    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("pending");

    const saved: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(saved.bids.length).toBe(1);
    expect(saved.bids[0]!.status).toBe("pending");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid when no active bidding period", async () => {
    const { unlink } = await import("fs/promises");
    const dataPath = join(tempDir, ".bidme/data/current-period.json");
    try { await unlink(dataPath); } catch {}

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No active bidding period");
  });

  test("rejects bid when period is closed", async () => {
    const periodData = makePeriodData();
    periodData.status = "closed";
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not open");
  });

  test("rejects unparseable bid comment", async () => {
    const periodData = makePeriodData();
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub({
      comment: { id: 1001, body: "Not a valid bid", user: { login: "bidder1" }, created_at: "" },
    });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("parse");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid lower than current highest", async () => {
    const existingBid = makeBid({ amount: 200, status: "approved" });
    const periodData = makePeriodData([existingBid]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub();

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("higher");

    globalThis.fetch = originalFetch;
  });
});

// ─── Issue Body Generation ───────────────────────────────────────────────────

describe("issue body generation", () => {
  test("includes previous stats when available", () => {
    const periodData = makePeriodData();
    const previousStats = {
      period_id: "period-2026-01-01",
      views: 5000,
      clicks: 250,
      ctr: 5.0,
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2026-01-08T00:00:00.000Z",
    };

    const body = generateBidIssueBody(DEFAULT_CONFIG, periodData, previousStats);

    expect(body).toContain("Previous Period Stats");
    expect(body).toContain("5000 views");
    expect(body).toContain("250 clicks");
    expect(body).toContain("5.0% CTR");
  });

  test("shows first bidding period message when no previous stats", () => {
    const periodData = makePeriodData();
    const body = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    expect(body).toContain("Previous Period Stats");
    expect(body).toContain("First bidding period — no previous stats yet");
  });

  test("shows 'No bids yet' when there are no bids", () => {
    const periodData = makePeriodData();
    const body = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    expect(body).toContain("No bids yet");
  });

  test("includes bid table with correct bid data", () => {
    const bids = [
      makeBid({ bidder: "alice", amount: 200, status: "approved", comment_id: 1001 }),
      makeBid({ bidder: "bob", amount: 100, status: "pending", comment_id: 1002 }),
    ];
    const periodData = makePeriodData(bids);
    const body = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    expect(body).toContain("@alice");
    expect(body).toContain("$200");
    expect(body).toContain("@bob");
    expect(body).toContain("$100");
    expect(body).toContain("✅ approved");
    expect(body).toContain("⏳ pending");
  });

  test("shows current top approved bid correctly", () => {
    const bids = [
      makeBid({ bidder: "alice", amount: 200, status: "approved", comment_id: 1001 }),
      makeBid({ bidder: "bob", amount: 300, status: "pending", comment_id: 1002 }),
    ];

    const topBid = generateCurrentTopBid(bids);
    expect(topBid).toContain("$200");
    expect(topBid).toContain("@alice");
    expect(topBid).not.toContain("$300");
  });

  test("includes schedule, rules, and config values", () => {
    const periodData = makePeriodData();
    const body = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    expect(body).toContain("Banner Sponsorship");
    expect(body).toContain("monthly");
    expect(body).toContain("$50");
    expect(body).toContain("$5");
    expect(body).toContain("800x100");
    expect(body).toContain("png, jpg, svg");
  });
});

// ─── Issue Body Updates ──────────────────────────────────────────────────────

describe("issue body updates (live bid info)", () => {
  test("updates bid table with new bids", () => {
    const periodData = makePeriodData();
    const initialBody = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    const bids = [
      makeBid({ bidder: "alice", amount: 100, status: "approved", comment_id: 1001 }),
    ];

    const updated = updateBidIssueBody(initialBody, bids);

    expect(updated).toContain("@alice");
    expect(updated).toContain("$100");
    expect(updated).toContain("✅ approved");
  });

  test("updates current top bid section", () => {
    const periodData = makePeriodData();
    const initialBody = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    const bids = [
      makeBid({ bidder: "alice", amount: 100, status: "approved", comment_id: 1001 }),
      makeBid({ bidder: "bob", amount: 200, status: "approved", comment_id: 1002 }),
    ];

    const updated = updateBidIssueBody(initialBody, bids);
    expect(updated).toContain("$200");
    expect(updated).toContain("@bob");
  });

  test("injects previous stats section when updating", () => {
    const periodData = makePeriodData();
    const initialBody = generateBidIssueBody(DEFAULT_CONFIG, periodData);

    const previousStats = {
      period_id: "period-2026-01-01",
      views: 3000,
      clicks: 150,
      ctr: 5.0,
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2026-01-08T00:00:00.000Z",
    };

    const updated = updateBidIssueBody(initialBody, [], previousStats);
    expect(updated).toContain("3000 views");
    expect(updated).toContain("150 clicks");
  });
});

// ─── Close Bidding: Winner Selection ─────────────────────────────────────────

describe("close-bidding: winner selection", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-close-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_test_token_fake";
    delete process.env["STRIPE_SECRET_KEY"];
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = { ...originalEnv };
    mock.restore();
  });

  test("selects highest approved bid as winner, not just highest bid", async () => {
    const bids = [
      makeBid({ bidder: "alice", amount: 100, status: "approved", comment_id: 1001 }),
      makeBid({ bidder: "bob", amount: 500, status: "pending", comment_id: 1002 }),
      makeBid({ bidder: "charlie", amount: 300, status: "approved", comment_id: 1003 }),
      makeBid({ bidder: "dave", amount: 400, status: "rejected", comment_id: 1004 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));
    await Bun.write(join(tempDir, "README.md"), "<!-- BIDME:BANNER:START -->\nold banner\n<!-- BIDME:BANNER:END -->\n\n# Hello");

    const originalFetch = mockFetchForGitHub();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("charlie");
    expect(result.message).toContain("$300");
    expect(result.message).not.toContain("bob");

    globalThis.fetch = originalFetch;
  });

  test("handles no approved bids gracefully", async () => {
    const bids = [
      makeBid({ bidder: "alice", amount: 100, status: "pending", comment_id: 1001 }),
      makeBid({ bidder: "bob", amount: 200, status: "rejected", comment_id: 1002 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("no winner");

    globalThis.fetch = originalFetch;
  });

  test("handles empty bids array", async () => {
    const periodData = makePeriodData([]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = mockFetchForGitHub();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("no winner");

    globalThis.fetch = originalFetch;
  });

  test("returns error when period is not open", async () => {
    const periodData = makePeriodData();
    periodData.status = "closed";
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not open");
  });
});

// ─── Tracking URL Injection ──────────────────────────────────────────────────

describe("tracking URL injection", () => {
  test("appends ?source=bidme&repo=... to URL without query params", () => {
    const result = appendTrackingParams("https://example.com", "alice", "myrepo");
    expect(result).toBe("https://example.com?source=bidme&repo=alice/myrepo");
  });

  test("appends &source=bidme&repo=... to URL that already has query params", () => {
    const result = appendTrackingParams("https://example.com?utm=abc", "alice", "myrepo");
    expect(result).toBe("https://example.com?utm=abc&source=bidme&repo=alice/myrepo");
  });

  test("works with paths in URLs", () => {
    const result = appendTrackingParams("https://example.com/page/about", "owner", "repo");
    expect(result).toBe("https://example.com/page/about?source=bidme&repo=owner/repo");
  });

  test("works with complex existing query strings", () => {
    const result = appendTrackingParams("https://example.com/path?foo=1&bar=2", "o", "r");
    expect(result).toBe("https://example.com/path?foo=1&bar=2&source=bidme&repo=o/r");
  });

  test("handles special characters in owner/repo", () => {
    const result = appendTrackingParams("https://example.com", "my-org", "my-repo");
    expect(result).toBe("https://example.com?source=bidme&repo=my-org/my-repo");
  });
});

// ─── Archive Period Data ─────────────────────────────────────────────────────

describe("archive period data structure", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-archive-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    delete process.env["GITHUB_REPOSITORY_OWNER"];
    delete process.env["GITHUB_REPOSITORY"];
    delete process.env["STRIPE_SECRET_KEY"];
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = { ...originalEnv };
    mock.restore();
  });

  test("archives period data to correct path with date in filename", async () => {
    const bids = [makeBid({ status: "approved" })];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runCloseBidding } = await import("../close-bidding.js");
    await runCloseBidding({ target: tempDir });

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archiveFile = Bun.file(archivePath);
    expect(await archiveFile.exists()).toBe(true);

    const archived: PeriodData = JSON.parse(await archiveFile.text());
    expect(archived.period_id).toBe("period-2026-02-01");
    expect(archived.status).toBe("closed");
    expect(archived.bids).toHaveLength(1);
    expect(archived.bids[0]!.bidder).toBe("bidder1");
    expect(archived.bids[0]!.amount).toBe(100);
  });

  test("clears current-period.json after archiving", async () => {
    const periodData = makePeriodData([makeBid({ status: "approved" })]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runCloseBidding } = await import("../close-bidding.js");
    await runCloseBidding({ target: tempDir });

    const currentFile = Bun.file(join(tempDir, ".bidme/data/current-period.json"));
    const text = await currentFile.text();
    expect(text.trim()).toBe("");
  });

  test("archived data contains all bid records", async () => {
    const bids = [
      makeBid({ bidder: "a", amount: 100, status: "approved", comment_id: 1001 }),
      makeBid({ bidder: "b", amount: 200, status: "pending", comment_id: 1002 }),
      makeBid({ bidder: "c", amount: 150, status: "rejected", comment_id: 1003 }),
    ];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runCloseBidding } = await import("../close-bidding.js");
    await runCloseBidding({ target: tempDir });

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.bids).toHaveLength(3);
    expect(archived.bids.map((b) => b.bidder).sort()).toEqual(["a", "b", "c"]);
  });
});

// ─── Close Bidding: Stripe Payment Processing ────────────────────────────────

function mockFetchForStripe(overrides: Record<string, any> = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("api.stripe.com")) {
      if (url.includes("/payment_intents") && init?.method === "POST") {
        if (overrides.stripePaymentFails) {
          return new Response(
            JSON.stringify({
              error: {
                type: "card_error",
                code: "card_declined",
                decline_code: "insufficient_funds",
                message: "Your card was declined.",
              },
            }),
            { status: 402, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify(
            overrides.paymentIntent ?? {
              id: "pi_test_123456",
              amount: 10000,
              currency: "usd",
              status: "succeeded",
              customer: "cus_test_abc",
              payment_method: "pm_test_xyz",
              metadata: {},
            },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    if (url.includes("/comments/") && (!init?.method || init?.method === "GET")) {
      return new Response(
        JSON.stringify(
          overrides.comment ?? {
            id: 1001,
            body: "```yaml\namount: 100\nbanner_url: https://example.com/banner.png\ndestination_url: https://example.com\ncontact: bid@example.com\n```",
            user: { login: "bidder1" },
            created_at: "2026-02-02T10:00:00.000Z",
          },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/issues/") && (!init?.method || init?.method === "GET")) {
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

    if (url.includes("/issues") && init?.method === "POST") {
      return new Response(
        JSON.stringify(
          overrides.createdIssue ?? {
            number: 42,
            html_url: "https://github.com/testowner/testrepo/issues/42",
            node_id: "I_abc123",
            body: "",
            title: "",
            state: "open",
          },
        ),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/issues/") && init?.method === "PATCH") {
      return new Response(
        JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/comments") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/graphql")) {
      return new Response(
        JSON.stringify({ data: { pinIssue: { issue: { id: "I_abc123" } }, unpinIssue: { issue: { id: "I_abc123" } } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/reactions")) {
      return new Response(JSON.stringify(overrides.reactions ?? []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/contents/")) {
      return new Response(
        JSON.stringify({ content: "", sha: "abc123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!url.includes("api.github.com") && !url.includes("api.stripe.com") && (init?.method === "HEAD" || !init?.method)) {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": "1024",
        },
      });
    }

    return originalFetch(input, init);
  }) as unknown as typeof fetch;
  return originalFetch;
}

describe("close-bidding: Stripe payment processing", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-stripe-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_test_token_fake";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake_key";
  });

  afterEach(async () => {
    resetRegistryCache();
    await rm(tempDir, { recursive: true });
    process.env = { ...originalEnv };
    mock.restore();
  });

  test("charges winner via Stripe when payment method is on file", async () => {
    const bids = [makeBid({ bidder: "alice", amount: 100, status: "approved", comment_id: 1001 })];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));
    await Bun.write(join(tempDir, "README.md"), "<!-- BIDME:BANNER:START -->\nold\n<!-- BIDME:BANNER:END -->");

    const bidderRegistry = {
      bidders: {
        alice: {
          github_username: "alice",
          payment_linked: true,
          linked_at: "2026-02-01T00:00:00.000Z",
          warned_at: null,
          stripe_customer_id: "cus_test_alice",
          stripe_payment_method_id: "pm_test_alice",
        },
      },
    };
    await Bun.write(join(tempDir, ".bidme/data/bidders.json"), JSON.stringify(bidderRegistry));

    const originalFetch = mockFetchForStripe();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("alice");

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.payment).toBeDefined();
    expect(archived.payment?.payment_status).toBe("paid");
    expect(archived.payment?.stripe_payment_intent_id).toBe("pi_test_123456");

    globalThis.fetch = originalFetch;
  });

  test("handles Stripe payment failure gracefully", async () => {
    const bids = [makeBid({ bidder: "bob", amount: 150, status: "approved", comment_id: 1002 })];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));
    await Bun.write(join(tempDir, "README.md"), "<!-- BIDME:BANNER:START -->\nold\n<!-- BIDME:BANNER:END -->");

    const bidderRegistry = {
      bidders: {
        bob: {
          github_username: "bob",
          payment_linked: true,
          linked_at: "2026-02-01T00:00:00.000Z",
          warned_at: null,
          stripe_customer_id: "cus_test_bob",
          stripe_payment_method_id: "pm_test_bob",
        },
      },
    };
    await Bun.write(join(tempDir, ".bidme/data/bidders.json"), JSON.stringify(bidderRegistry));

    const originalFetch = mockFetchForStripe({ stripePaymentFails: true });

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("bob");

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.payment).toBeDefined();
    expect(archived.payment?.payment_status).toBe("failed");

    globalThis.fetch = originalFetch;
  });

  test("marks payment as pending when no payment method on file", async () => {
    const bids = [makeBid({ bidder: "charlie", amount: 200, status: "approved", comment_id: 1003 })];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));
    await Bun.write(join(tempDir, "README.md"), "<!-- BIDME:BANNER:START -->\nold\n<!-- BIDME:BANNER:END -->");

    const bidderRegistry = {
      bidders: {
        charlie: {
          github_username: "charlie",
          payment_linked: false,
          linked_at: null,
          warned_at: null,
        },
      },
    };
    await Bun.write(join(tempDir, ".bidme/data/bidders.json"), JSON.stringify(bidderRegistry));

    const originalFetch = mockFetchForStripe();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("charlie");

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.payment).toBeDefined();
    expect(archived.payment?.payment_status).toBe("pending");

    globalThis.fetch = originalFetch;
  });

  test("skips payment when Stripe is not configured", async () => {
    delete process.env["STRIPE_SECRET_KEY"];

    const bids = [makeBid({ bidder: "dave", amount: 100, status: "approved", comment_id: 1004 })];
    const periodData = makePeriodData(bids);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));
    await Bun.write(join(tempDir, "README.md"), "<!-- BIDME:BANNER:START -->\nold\n<!-- BIDME:BANNER:END -->");

    const originalFetch = mockFetchForStripe();

    const { runCloseBidding } = await import("../close-bidding.js");
    const result = await runCloseBidding({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("dave");

    const archivePath = join(tempDir, ".bidme/data/archive/period-2026-02-01.json");
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.payment).toBeUndefined();

    globalThis.fetch = originalFetch;
  });
});
