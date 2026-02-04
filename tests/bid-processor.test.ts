import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import type { PeriodData } from "../scripts/bid-opener.ts";

describe("bid-processor", () => {
  let tempDir: string;
  let dataDir: string;
  let configPath: string;

  const makePeriodData = (overrides?: Partial<PeriodData>): PeriodData => ({
    period_id: "period-2026-02-04",
    start_date: "2026-02-04T00:00:00.000Z",
    end_date: "2026-02-11T00:00:00.000Z",
    issue_number: 42,
    issue_node_id: "I_abc123",
    status: "open",
    bids: [],
    ...overrides,
  });

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-processor-"));
    dataDir = resolve(tempDir, "data");
    await mkdir(dataDir, { recursive: true });

    configPath = resolve(tempDir, "bidme-config.yml");
    await Bun.write(
      configPath,
      `bidding:\n  schedule: "monthly"\n  duration: 7\n  minimum_bid: 50\n  increment: 5\nbanner:\n  width: 800\n  height: 100\n  format: "png,jpg,svg"\n  max_size: 200\n  position: "top"\n`,
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  beforeEach(async () => {
    await Bun.write(
      resolve(dataDir, "current-period.json"),
      JSON.stringify(makePeriodData(), null, 2),
    );
  });

  describe("generateBidTable", () => {
    test("returns empty table when no bids", async () => {
      const { generateBidTable } = await import("../scripts/bid-processor.ts");
      const table = generateBidTable([]);
      expect(table).toContain("No bids yet");
      expect(table).toContain("| Rank |");
    });

    test("generates table with single bid", async () => {
      const { generateBidTable } = await import("../scripts/bid-processor.ts");
      const table = generateBidTable([
        {
          bidder: "testuser",
          amount: 100,
          banner_url: "https://example.com/banner.png",
          destination_url: "https://example.com",
          contact: "test@example.com",
          status: "pending",
          comment_id: 1,
          timestamp: "2026-02-04T12:00:00Z",
        },
      ]);
      expect(table).toContain("@testuser");
      expect(table).toContain("$100");
      expect(table).toContain("⏳ pending");
      expect(table).toContain("[preview]");
    });

    test("sorts bids by amount descending", async () => {
      const { generateBidTable } = await import("../scripts/bid-processor.ts");
      const table = generateBidTable([
        {
          bidder: "lowbidder",
          amount: 50,
          banner_url: "https://example.com/low.png",
          destination_url: "https://example.com",
          contact: "low@example.com",
          status: "pending",
          comment_id: 1,
          timestamp: "2026-02-04T12:00:00Z",
        },
        {
          bidder: "highbidder",
          amount: 200,
          banner_url: "https://example.com/high.png",
          destination_url: "https://example.com",
          contact: "high@example.com",
          status: "approved",
          comment_id: 2,
          timestamp: "2026-02-04T13:00:00Z",
        },
      ]);
      const lines = table.split("\n");
      const dataRows = lines.filter((l) => l.includes("@"));
      expect(dataRows[0]).toContain("@highbidder");
      expect(dataRows[0]).toContain("$200");
      expect(dataRows[1]).toContain("@lowbidder");
      expect(dataRows[1]).toContain("$50");
    });

    test("shows correct status emoji for each state", async () => {
      const { generateBidTable } = await import("../scripts/bid-processor.ts");
      const table = generateBidTable([
        {
          bidder: "approved-user",
          amount: 150,
          banner_url: "https://example.com/a.png",
          destination_url: "https://example.com",
          contact: "a@example.com",
          status: "approved",
          comment_id: 1,
          timestamp: "2026-02-04T12:00:00Z",
        },
        {
          bidder: "pending-user",
          amount: 100,
          banner_url: "https://example.com/p.png",
          destination_url: "https://example.com",
          contact: "p@example.com",
          status: "pending",
          comment_id: 2,
          timestamp: "2026-02-04T13:00:00Z",
        },
        {
          bidder: "rejected-user",
          amount: 75,
          banner_url: "https://example.com/r.png",
          destination_url: "https://example.com",
          contact: "r@example.com",
          status: "rejected",
          comment_id: 3,
          timestamp: "2026-02-04T14:00:00Z",
        },
      ]);
      expect(table).toContain("✅ approved");
      expect(table).toContain("⏳ pending");
      expect(table).toContain("❌ rejected");
    });
  });

  describe("updateIssueBodyWithBids", () => {
    test("replaces bid table in issue body", async () => {
      const { updateIssueBodyWithBids } = await import("../scripts/bid-processor.ts");
      const body = `## 🎯 BidMe Banner Bidding

### Rules
- **Minimum bid:** $50

### Current Status

| Rank | Bidder | Amount | Status | Banner Preview |
|------|--------|--------|--------|----------------|
| — | No bids yet | — | — | — |

### How to Bid

Post a comment.`;

      const updated = updateIssueBodyWithBids(body, [
        {
          bidder: "alice",
          amount: 100,
          banner_url: "https://example.com/banner.png",
          destination_url: "https://example.com",
          contact: "alice@example.com",
          status: "pending",
          comment_id: 1,
          timestamp: "2026-02-04T12:00:00Z",
        },
      ]);

      expect(updated).toContain("@alice");
      expect(updated).toContain("$100");
      expect(updated).not.toContain("No bids yet");
      expect(updated).toContain("### How to Bid");
    });
  });

  describe("processBid", () => {
    test("returns error when no period file exists", async () => {
      const { processBid } = await import("../scripts/bid-processor.ts");

      const emptyDir = resolve(tempDir, "empty");
      await mkdir(resolve(emptyDir, "data"), { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(emptyDir);

      try {
        const result = await processBid(42, 1, configPath);
        expect(result.success).toBe(false);
        expect(result.message).toContain("No active bidding period");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("returns error when period is closed", async () => {
      const { processBid } = await import("../scripts/bid-processor.ts");

      const closedDir = resolve(tempDir, "closed");
      const closedDataDir = resolve(closedDir, "data");
      await mkdir(closedDataDir, { recursive: true });
      await Bun.write(
        resolve(closedDataDir, "current-period.json"),
        JSON.stringify(makePeriodData({ status: "closed" }), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(closedDir);

      try {
        const result = await processBid(42, 1, configPath);
        expect(result.success).toBe(false);
        expect(result.message).toContain("not open");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("runs in local mode without GitHub env and fails parse for empty comment", async () => {
      const { processBid } = await import("../scripts/bid-processor.ts");

      const originalCwd = process.cwd();
      process.chdir(tempDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await processBid(42, 1, configPath);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Could not parse bid");
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });

    test("script shows usage error with missing arguments", async () => {
      const proc = Bun.spawn(
        [
          "bun",
          "run",
          resolve(import.meta.dir, "../scripts/bid-processor.ts"),
        ],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            GITHUB_TOKEN: undefined,
            GITHUB_REPOSITORY_OWNER: undefined,
            GITHUB_REPOSITORY: undefined,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Usage:");
    });

    test("script runs via bun with valid arguments", async () => {
      await Bun.write(
        resolve(dataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const proc = Bun.spawn(
        [
          "bun",
          "run",
          resolve(import.meta.dir, "../scripts/bid-processor.ts"),
          "42",
          "1",
        ],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            GITHUB_TOKEN: undefined,
            GITHUB_REPOSITORY_OWNER: undefined,
            GITHUB_REPOSITORY: undefined,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      const output = await new Response(proc.stdout).text();
      await proc.exited;
      expect(output).toContain("BidMe: Processing Bid");
      expect(output).toContain("Issue: #42");
      expect(output).toContain("Comment: 1");
    });
  });

  describe("bid increment validation via processBid", () => {
    test("rejects bid lower than current highest", async () => {
      const { processBid } = await import("../scripts/bid-processor.ts");

      const incrDir = resolve(tempDir, "incr");
      const incrDataDir = resolve(incrDir, "data");
      await mkdir(incrDataDir, { recursive: true });

      const periodWithBid = makePeriodData({
        bids: [
          {
            bidder: "firstbidder",
            amount: 100,
            banner_url: "https://example.com/banner.png",
            destination_url: "https://example.com",
            contact: "first@example.com",
            status: "pending",
            comment_id: 1,
            timestamp: "2026-02-04T12:00:00Z",
          },
        ],
      });
      await Bun.write(
        resolve(incrDataDir, "current-period.json"),
        JSON.stringify(periodWithBid, null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(incrDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await processBid(42, 2, configPath);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Could not parse bid");
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });
  });
});

describe("github-api getComment and getIssue", () => {
  test("getComment calls correct endpoint", async () => {
    const calls: { url: string; method: string }[] = [];
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, method: init?.method ?? "GET" });
      return new Response(
        JSON.stringify({
          id: 999,
          body: "test comment",
          user: { login: "testuser" },
          created_at: "2026-02-04T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      const { GitHubAPI } = await import("../scripts/utils/github-api.ts");
      const api = new GitHubAPI("owner", "repo", "test-token");
      const comment = await api.getComment(999);

      expect(comment.id).toBe(999);
      expect(comment.body).toBe("test comment");
      expect(comment.user.login).toBe("testuser");
      expect(calls[0]!.url).toContain("/issues/comments/999");
      expect(calls[0]!.method).toBe("GET");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("getIssue calls correct endpoint", async () => {
    const calls: { url: string; method: string }[] = [];
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, method: init?.method ?? "GET" });
      return new Response(
        JSON.stringify({
          number: 42,
          html_url: "https://github.com/owner/repo/issues/42",
          title: "Test Issue",
          body: "Test body",
          state: "open",
          node_id: "I_abc",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      const { GitHubAPI } = await import("../scripts/utils/github-api.ts");
      const api = new GitHubAPI("owner", "repo", "test-token");
      const issue = await api.getIssue(42);

      expect(issue.number).toBe(42);
      expect(issue.body).toBe("Test body");
      expect(calls[0]!.url).toContain("/issues/42");
      expect(calls[0]!.method).toBe("GET");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
