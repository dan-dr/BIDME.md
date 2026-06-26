import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import type { BidMeConfig } from "../../lib/config.js";
import { DEFAULT_CONFIG, generateToml } from "../../lib/config.js";
import { generateBidIssueBody } from "../../lib/issue-template.js";
import { scaffold } from "../../lib/scaffold.js";
import type { BidRecord, PeriodData } from "../../lib/types.js";
import { parseBidComment, validateBid } from "../../lib/validation.js";
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
    tagline: "Build faster",
    status: "pending",
    comment_id: 1001,
    timestamp: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

function makeAutoConfig(): BidMeConfig {
  return {
    ...DEFAULT_CONFIG,
    approval: { ...DEFAULT_CONFIG.approval, mode: "auto" },
  };
}

function bidBody(amount = 100): string {
  return `---
bid:
  amount: ${amount}
  destination_url: "https://example.com"
  tagline: "Build faster"
---

![Banner](https://example.com/banner.png)`;
}

interface MockState {
  variableWrites: Record<string, unknown>;
  comments: string[];
  issueBodyUpdates: string[];
}

function mockFetchForGitHub(state: MockState, overrides: Record<string, unknown> = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/actions/variables/") && method === "GET") {
      const name = url.split("/").pop()!;
      const value =
        name === "BIDME_CURRENT_PERIOD"
          ? JSON.stringify(overrides.period ?? makePeriodData())
          : JSON.stringify(overrides.analytics ?? { clicks: [], daily_views: [], periods: [] });
      return Response.json({ name, value });
    }

    if (url.includes("/actions/variables/") && method === "PATCH") {
      const name = url.split("/").pop()!;
      const body = JSON.parse(String(init?.body ?? "{}")) as { value?: string };
      state.variableWrites[name] = body.value ? JSON.parse(body.value) : null;
      return new Response(null, { status: 204 });
    }

    if (url.includes("/customers/search")) {
      return Response.json({
        data: overrides.customers ?? [{ id: "cus_123", metadata: { github_username: "bidder1" } }],
      });
    }

    if (url.endsWith("/customers") && method === "POST") {
      return Response.json({ id: "cus_123", metadata: { github_username: "bidder1" } });
    }

    if (url.includes("/customers/cus_123/payment_methods")) {
      return Response.json({
        data: overrides.paymentMethods ?? [{ id: "pm_123", type: "card", customer: "cus_123" }],
      });
    }

    if (url.includes("/checkout/sessions") && method === "POST") {
      if (overrides.checkoutFails) {
        return Response.json({ error: { message: "checkout unavailable" } }, { status: 500 });
      }
      return Response.json({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      });
    }

    if (url.includes("/comments/") && method === "GET") {
      return Response.json({
        id: 1001,
        body: overrides.commentBody ?? bidBody(),
        user: { login: overrides.commentUser ?? "bidder1" },
        created_at: "2026-02-02T10:00:00.000Z",
      });
    }

    if (url.includes("/issues/42") && method === "GET") {
      return Response.json({
        number: 42,
        body: generateBidIssueBody(DEFAULT_CONFIG, makePeriodData()),
        html_url: "https://github.com/testowner/testrepo/issues/42",
        title: "BIDME",
        state: "open",
        node_id: "I_abc123",
      });
    }

    if (url.includes("/issues/42") && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { body?: string };
      if (body.body) state.issueBodyUpdates.push(body.body);
      return Response.json({
        number: 42,
        body: body.body ?? "",
        html_url: "",
        title: "",
        state: "open",
        node_id: "",
      });
    }

    if (url.includes("/comments") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { body?: string };
      state.comments.push(body.body ?? "");
      return Response.json(
        { id: 2000, body: body.body ?? "", user: { login: "bidme-bot" }, created_at: "" },
        { status: 201 },
      );
    }

    if (!url.includes("api.github.com") && (method === "HEAD" || method === "GET")) {
      return new Response(null, {
        status: 200,
        headers: { "Content-Type": "image/png", "Content-Length": "1024" },
      });
    }

    return originalFetch(input, init);
  }) as unknown as typeof fetch;
  return originalFetch;
}

describe("bid parsing and validation", () => {
  test("parses new YAML frontmatter bid comment and attached image", () => {
    const parsed = parseBidComment(bidBody(150));
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(150);
    expect(parsed!.destination_url).toBe("https://example.com");
    expect(parsed!.tagline).toBe("Build faster");
    expect(parsed!.banner_url).toBe("https://example.com/banner.png");
  });

  test("requires an attached banner image and tagline", () => {
    expect(
      parseBidComment('---\nbid:\n  amount: 100\n  destination_url: "https://example.com"\n---'),
    ).toBeNull();
    const result = validateBid(
      {
        amount: 100,
        banner_url: "",
        destination_url: "https://example.com",
        tagline: "Build faster",
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "banner_url")).toBe(true);
  });

  test("validates amount and URL fields", () => {
    const result = validateBid(
      {
        amount: 53,
        banner_url: "https://x.com/b.png",
        destination_url: "notaurl",
        tagline: "Build faster",
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "amount")).toBe(true);
    expect(result.errors.some((e) => e.field === "destination_url")).toBe(true);
  });
});

describe("process-bid with GitHub variable state", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-bidding-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_test_token_fake";
    process.env["BIDME_PAT"] = "ghp_test_pat_fake";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = originalEnv;
    mock.restore();
  });

  test("auto-approve mode records approved bid in BIDME_CURRENT_PERIOD", async () => {
    await Bun.write(join(tempDir, ".bidme/config.toml"), generateToml(makeAutoConfig()));
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state);

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const saved = state.variableWrites["BIDME_CURRENT_PERIOD"] as PeriodData;
    expect(saved.bids).toHaveLength(1);
    expect(saved.bids[0]!.status).toBe("approved");
    expect(saved.bids[0]!.tagline).toBe("Build faster");
    expect(state.issueBodyUpdates.at(-1)).toContain("@bidder1");

    globalThis.fetch = originalFetch;
  });

  test("unlinked bidder is recorded as unlinked_pending and gets setup warning", async () => {
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state, { customers: [], paymentMethods: [] });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const saved = state.variableWrites["BIDME_CURRENT_PERIOD"] as PeriodData;
    expect(saved.bids[0]!.status).toBe("unlinked_pending");
    expect(state.comments.join("\n")).toContain("authorize your payment method");
    expect(state.comments.join("\n")).toContain("https://checkout.stripe.com/c/pay/cs_test_123");

    globalThis.fetch = originalFetch;
  });

  test("does not link payment authorization to success page when checkout cannot be created", async () => {
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state, {
      customers: [],
      paymentMethods: [],
      checkoutFails: true,
    });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const comments = state.comments.join("\n");
    expect(comments).toContain("payment authorization could not be started");
    expect(comments).not.toContain("success.html");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid lower than current highest", async () => {
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state, {
      period: makePeriodData([makeBid({ amount: 200, status: "approved" })]),
    });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("higher");
    expect(state.variableWrites["BIDME_CURRENT_PERIOD"]).toBeUndefined();

    globalThis.fetch = originalFetch;
  });

  test("owner slash command approves a pending bid", async () => {
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state, {
      commentBody: "/approve @bidder1",
      commentUser: "testowner",
      period: makePeriodData([makeBid({ status: "pending" })]),
    });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    const saved = state.variableWrites["BIDME_CURRENT_PERIOD"] as PeriodData;
    expect(saved.bids[0]!.status).toBe("approved");
    expect(state.comments.join("\n")).toContain("Approved bid from @bidder1");
    expect(state.issueBodyUpdates.at(-1)).toContain("✅ approved");

    globalThis.fetch = originalFetch;
  });

  test("slash approval does not approve unlinked payment bids", async () => {
    const state: MockState = { variableWrites: {}, comments: [], issueBodyUpdates: [] };
    const originalFetch = mockFetchForGitHub(state, {
      commentBody: "/approve @bidder1",
      commentUser: "testowner",
      period: makePeriodData([makeBid({ status: "unlinked_pending" })]),
    });

    const { runProcessBid } = await import("../process-bid.js");
    const result = await runProcessBid(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("payment is linked");
    expect(state.variableWrites["BIDME_CURRENT_PERIOD"]).toBeUndefined();

    globalThis.fetch = originalFetch;
  });
});

describe("issue body and tracking helpers", () => {
  test("issue body includes live analytics anchors and new bid instructions", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriodData());
    expect(body).toContain("<!-- bidme-analytics-start -->");
    expect(body).toContain("Attach your banner image");
    expect(body).toContain("tagline:");
    expect(body).not.toContain("contact:");
  });

  test("tracking params use UTM template", () => {
    expect(appendTrackingParams("https://example.com", "alice", "repo")).toBe(
      "https://example.com?utm_source=bidme&utm_campaign=alice/repo",
    );
    expect(appendTrackingParams("https://example.com?x=1", "alice", "repo")).toBe(
      "https://example.com?x=1&utm_source=bidme&utm_campaign=alice/repo",
    );
  });
});
