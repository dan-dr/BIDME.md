import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { DEFAULT_CONFIG } from "../../lib/config.js";
import type { PeriodData, BidRecord } from "../../lib/types.js";

function makePeriodData(bids: BidRecord[] = []): PeriodData {
  return {
    period_id: "2026-02",
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

describe("process-approval", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-approval-test-"));
    await scaffold(tempDir, DEFAULT_CONFIG);
    process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
    process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
    process.env["GITHUB_TOKEN"] = "ghp_test_token_fake";
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = { ...originalEnv };
    mock.restore();
  });

  test("returns early with success when approval mode is 'auto'", async () => {
    const autoConfig = { ...DEFAULT_CONFIG, approval: { ...DEFAULT_CONFIG.approval, mode: "auto" as const } };
    const configPath = join(tempDir, ".bidme", "config.toml");
    const { generateToml } = await import("../../lib/config.js");
    await Bun.write(configPath, generateToml(autoConfig));

    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("auto");
  });

  test("fails when no active bidding period exists", async () => {
    const dataPath = join(tempDir, ".bidme/data/current-period.json");
    const file = Bun.file(dataPath);
    if (await file.exists()) {
      const { unlink } = await import("fs/promises");
      await unlink(dataPath);
    }

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No active bidding period");
  });

  test("fails when bidding period is closed", async () => {
    const periodData = makePeriodData([makeBid()]);
    periodData.status = "closed";
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not open");
  });

  test("fails when comment ID doesn't match any bid", async () => {
    const periodData = makePeriodData([makeBid({ comment_id: 9999 })]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No bid found");
  });

  test("returns success when bid is already approved", async () => {
    const periodData = makePeriodData([makeBid({ status: "approved" })]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("already approved");
  });

  test("returns success when bid is already rejected", async () => {
    const periodData = makePeriodData([makeBid({ status: "rejected" })]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("already rejected");
  });

  test("fails when GitHub environment is not configured", async () => {
    delete process.env["GITHUB_REPOSITORY_OWNER"];
    delete process.env["GITHUB_REPOSITORY"];

    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain("GitHub environment not configured");
  });

  test("approves bid when owner reacted with allowed emoji", async () => {
    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/reactions")) {
        return new Response(JSON.stringify([
          { id: 1, content: "👍", user: { login: "testowner" } },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "GET") {
        return new Response(JSON.stringify({
          number: 42, body: "### 🔝 Current Top Bid\n\nNo bids yet\n\n### Rules\n\ntest\n\n### Bid Table\n\n| Rank |\n\n### How to Bid\n\ntest\n\n### Deadline\n\ntest",
          html_url: "", title: "", state: "open", node_id: "",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
          { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("approved");
    expect(result.message).toContain("bidder1");
    expect(result.message).toContain("$100");

    const updated: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(updated.bids[0]!.status).toBe("approved");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid when owner has not reacted", async () => {
    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/reactions")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "GET") {
        return new Response(JSON.stringify({
          number: 42, body: "### 🔝 Current Top Bid\n\nNo bids yet\n\n### Rules\n\ntest\n\n### Bid Table\n\n| Rank |\n\n### How to Bid\n\ntest\n\n### Deadline\n\ntest",
          html_url: "", title: "", state: "open", node_id: "",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
          { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("rejected");

    const updated: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(updated.bids[0]!.status).toBe("rejected");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid when reaction is from non-owner user", async () => {
    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/reactions")) {
        return new Response(JSON.stringify([
          { id: 1, content: "👍", user: { login: "some-other-user" } },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "GET") {
        return new Response(JSON.stringify({
          number: 42, body: "### 🔝 Current Top Bid\n\nNo bids yet\n\n### Rules\n\ntest\n\n### Bid Table\n\n| Rank |\n\n### How to Bid\n\ntest\n\n### Deadline\n\ntest",
          html_url: "", title: "", state: "open", node_id: "",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
          { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("rejected");

    const updated: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(updated.bids[0]!.status).toBe("rejected");

    globalThis.fetch = originalFetch;
  });

  test("rejects bid when owner reacted with wrong emoji", async () => {
    const periodData = makePeriodData([makeBid()]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/reactions")) {
        return new Response(JSON.stringify([
          { id: 1, content: "😂", user: { login: "testowner" } },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "GET") {
        return new Response(JSON.stringify({
          number: 42, body: "### 🔝 Current Top Bid\n\nNo bids yet\n\n### Rules\n\ntest\n\n### Bid Table\n\n| Rank |\n\n### How to Bid\n\ntest\n\n### Deadline\n\ntest",
          html_url: "", title: "", state: "open", node_id: "",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
          { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const { runProcessApproval } = await import("../process-approval.js");
    const result = await runProcessApproval(42, 1001, { target: tempDir });

    expect(result.success).toBe(true);
    expect(result.message).toContain("rejected");

    globalThis.fetch = originalFetch;
  });

  test("persists updated bid status to period data file", async () => {
    const bid1 = makeBid({ comment_id: 1001, bidder: "bidder1", amount: 100, status: "pending" });
    const bid2 = makeBid({ comment_id: 1002, bidder: "bidder2", amount: 200, status: "pending" });
    const periodData = makePeriodData([bid1, bid2]);
    await Bun.write(join(tempDir, ".bidme/data/current-period.json"), JSON.stringify(periodData));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/reactions")) {
        return new Response(JSON.stringify([
          { id: 1, content: "👍", user: { login: "testowner" } },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "GET") {
        return new Response(JSON.stringify({
          number: 42, body: "### 🔝 Current Top Bid\n\nNo bids yet\n\n### Rules\n\ntest\n\n### Bid Table\n\n| Rank |\n\n### How to Bid\n\ntest\n\n### Deadline\n\ntest",
          html_url: "", title: "", state: "open", node_id: "",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/issues/42") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ number: 42, body: "", html_url: "", title: "", state: "open", node_id: "" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/comments") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: 2000, body: "", user: { login: "bidme-bot" }, created_at: "" }),
          { status: 201, headers: { "Content-Type": "application/json" } });
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    const { runProcessApproval } = await import("../process-approval.js");
    await runProcessApproval(42, 1001, { target: tempDir });

    const updated: PeriodData = JSON.parse(await Bun.file(join(tempDir, ".bidme/data/current-period.json")).text());
    expect(updated.bids[0]!.status).toBe("approved");
    expect(updated.bids[1]!.status).toBe("pending");

    globalThis.fetch = originalFetch;
  });
});
