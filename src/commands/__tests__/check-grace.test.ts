import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import type { BidRecord, PeriodData } from "../../lib/types.js";

function makeBid(overrides: Partial<BidRecord> = {}): BidRecord {
  return {
    bidder: "bidder1",
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    tagline: "Build faster",
    status: "unlinked_pending",
    comment_id: 1001,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makePeriod(bids: BidRecord[]): PeriodData {
  return {
    period_id: "period-2026-02-01",
    status: "open",
    start_date: "2026-02-01T00:00:00.000Z",
    end_date: "2026-02-08T00:00:00.000Z",
    issue_number: 42,
    issue_url: "https://github.com/testowner/testrepo/issues/42",
    bids,
    created_at: "2026-02-01T00:00:00.000Z",
    issue_node_id: "I_abc",
  };
}

interface State {
  variableWrites: Record<string, unknown>;
  commentEdits: string[];
}

function mockFetch(
  state: State,
  period: PeriodData,
  overrides: { paymentMethods?: unknown[] } = {},
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/actions/variables/") && method === "GET") {
      const name = url.split("/").pop()!;
      const value =
        name === "BIDME_CURRENT_PERIOD"
          ? JSON.stringify(period)
          : JSON.stringify({ clicks: [], daily_views: [], periods: [] });
      return Response.json({ name, value });
    }
    if (url.includes("/actions/variables/") && method === "PATCH") {
      const name = url.split("/").pop()!;
      const body = JSON.parse(String(init?.body ?? "{}")) as { value?: string };
      state.variableWrites[name] = body.value ? JSON.parse(body.value) : null;
      return new Response(null, { status: 204 });
    }
    if (url.includes("/customers/search")) {
      return Response.json({ data: [{ id: "cus_1", metadata: { github_username: "bidder1" } }] });
    }
    if (url.includes("/payment_methods")) {
      return Response.json({ data: overrides.paymentMethods ?? [] });
    }
    if (url.includes("/comments/") && method === "GET") {
      return Response.json({
        id: 1001,
        body: "![Banner](https://example.com/banner.png)",
        user: { login: "bidder1" },
        created_at: "2026-02-02T10:00:00.000Z",
      });
    }
    if (url.includes("/comments/") && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { body?: string };
      state.commentEdits.push(body.body ?? "");
      return Response.json({
        id: 1001,
        body: body.body ?? "",
        user: { login: "bidder1" },
        created_at: "",
      });
    }
    if (url.includes("/issues/42") && method === "GET") {
      return Response.json({
        number: 42,
        body: "### Bid Table\n\nx\n\n### Deadline",
        html_url: "",
        title: "",
        state: "open",
        node_id: "I_abc",
      });
    }
    if (url.includes("/issues/42") && method === "PATCH") {
      return Response.json({
        number: 42,
        body: "",
        html_url: "",
        title: "",
        state: "open",
        node_id: "",
      });
    }
    return originalFetch(input, init);
  }) as unknown as typeof fetch;
  return originalFetch;
}

describe("check-grace", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-grace-"));
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_fake";
    process.env["BIDME_PAT"] = "ghp_fake";
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = originalEnv;
    mock.restore();
  });

  test("activates an unlinked bid once a payment method is linked", async () => {
    const period = makePeriod([makeBid()]);
    const state: State = { variableWrites: {}, commentEdits: [] };
    const originalFetch = mockFetch(state, period, { paymentMethods: [{ id: "pm_1" }] });

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    const saved = state.variableWrites["BIDME_CURRENT_PERIOD"] as PeriodData;
    expect(saved.bids[0]!.status).toBe("active");
    expect(state.commentEdits.join("\n")).toContain("Bid active");

    globalThis.fetch = originalFetch;
  });

  test("expires an unlinked bid past the grace window with no payment method", async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const period = makePeriod([makeBid({ timestamp: old })]);
    const state: State = { variableWrites: {}, commentEdits: [] };
    const originalFetch = mockFetch(state, period, { paymentMethods: [] });

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    const saved = state.variableWrites["BIDME_CURRENT_PERIOD"] as PeriodData;
    expect(saved.bids[0]!.status).toBe("expired");
    expect(state.commentEdits.join("\n")).toContain("Bid expired");

    globalThis.fetch = originalFetch;
  });

  test("leaves an unlinked bid pending within the grace window", async () => {
    const period = makePeriod([makeBid({ timestamp: new Date().toISOString() })]);
    const state: State = { variableWrites: {}, commentEdits: [] };
    const originalFetch = mockFetch(state, period, { paymentMethods: [] });

    const { runCheckGrace } = await import("../check-grace.js");
    const result = await runCheckGrace({ target: tempDir });

    expect(result.success).toBe(true);
    expect(state.variableWrites["BIDME_CURRENT_PERIOD"]).toBeUndefined();
    expect(result.message).toContain("within grace");

    globalThis.fetch = originalFetch;
  });
});
