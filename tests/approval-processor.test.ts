import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import type { PeriodData, BidRecord } from "../scripts/bid-opener";

const makeBid = (overrides?: Partial<BidRecord>): BidRecord => ({
  bidder: "testbidder",
  amount: 100,
  banner_url: "https://example.com/banner.png",
  destination_url: "https://example.com",
  contact: "test@example.com",
  status: "pending",
  comment_id: 555,
  timestamp: "2026-02-04T12:00:00Z",
  ...overrides,
});

const makePeriodData = (overrides?: Partial<PeriodData>): PeriodData => ({
  period_id: "period-2026-02-04",
  start_date: "2026-02-04T00:00:00.000Z",
  end_date: "2026-02-11T00:00:00.000Z",
  issue_number: 42,
  issue_node_id: "I_abc123",
  status: "open",
  bids: [makeBid()],
  ...overrides,
});

describe("approval-processor", () => {
  let tempDir: string;
  let dataDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-approval-"));
    dataDir = resolve(tempDir, "data");
    await mkdir(dataDir, { recursive: true });
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

  describe("processApproval", () => {
    test("returns error when no period file exists", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const emptyDir = resolve(tempDir, "empty");
      await mkdir(resolve(emptyDir, "data"), { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(emptyDir);

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(false);
        expect(result.message).toContain("No active bidding period");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("returns error when period is closed", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

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
        const result = await processApproval(42, 555);
        expect(result.success).toBe(false);
        expect(result.message).toContain("not open");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("returns error when comment ID does not match any bid", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const result = await processApproval(42, 999);
        expect(result.success).toBe(false);
        expect(result.message).toContain("No bid found for comment 999");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("returns error in local mode without GitHub env", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const originalCwd = process.cwd();
      process.chdir(tempDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(false);
        expect(result.message).toContain("GitHub environment not configured");
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });

    test("approves bid on 👍 reaction from owner", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const approveDir = resolve(tempDir, "approve");
      const approveDataDir = resolve(approveDir, "data");
      await mkdir(approveDataDir, { recursive: true });
      await Bun.write(
        resolve(approveDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(approveDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;
      const calls: { url: string; method: string; body?: string }[] = [];

      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";
        const body = init?.body ? String(init.body) : undefined;
        calls.push({ url, method, body });

        if (url.includes("/reactions")) {
          return new Response(
            JSON.stringify([{ id: 1, content: "+1", user: { login: "repoowner" } }]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "GET") {
          return new Response(
            JSON.stringify({
              number: 42,
              html_url: "https://github.com/repoowner/testrepo/issues/42",
              title: "Test Issue",
              body: "## 🎯 BidMe\n\n### Current Status\n\n| Rank | Bidder | Amount | Status | Banner Preview |\n|------|--------|--------|--------|----------------|\n| 1 | @testbidder | $100 | ⏳ pending | [preview](https://example.com/banner.png) |\n\n### How to Bid",
              state: "open",
              node_id: "I_abc123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "PATCH") {
          return new Response(
            JSON.stringify({ number: 42, html_url: "", title: "", body: "", state: "open", node_id: "" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/comments") && method === "POST") {
          return new Response(
            JSON.stringify({ id: 100, body: "", user: { login: "bot" }, created_at: "" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      };

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(true);
        expect(result.message).toContain("approved");
        expect(result.message).toContain("@testbidder");
        expect(result.message).toContain("$100");

        const updatedPeriod: PeriodData = JSON.parse(
          await Bun.file(resolve(approveDataDir, "current-period.json")).text(),
        );
        expect(updatedPeriod.bids[0]!.status).toBe("approved");

        const commentCall = calls.find((c) => c.url.includes("/comments") && c.method === "POST");
        expect(commentCall).toBeDefined();
        expect(commentCall!.body).toContain("approved");
      } finally {
        globalThis.fetch = origFetch;
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        else delete process.env["GITHUB_REPOSITORY_OWNER"];
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        else delete process.env["GITHUB_REPOSITORY"];
        if (origToken) process.env["GITHUB_TOKEN"] = origToken;
        else delete process.env["GITHUB_TOKEN"];
        process.chdir(originalCwd);
      }
    });

    test("rejects bid on 👎 reaction from owner", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const rejectDir = resolve(tempDir, "reject");
      const rejectDataDir = resolve(rejectDir, "data");
      await mkdir(rejectDataDir, { recursive: true });
      await Bun.write(
        resolve(rejectDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(rejectDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;

      globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? "GET";

        if (url.includes("/reactions")) {
          return new Response(
            JSON.stringify([{ id: 1, content: "-1", user: { login: "repoowner" } }]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "GET") {
          return new Response(
            JSON.stringify({
              number: 42, html_url: "", title: "", state: "open", node_id: "",
              body: "## 🎯 BidMe\n\n### Current Status\n\n| Rank | Bidder | Amount | Status | Banner Preview |\n|------|--------|--------|--------|----------------|\n| 1 | @testbidder | $100 | ⏳ pending | [preview](https://example.com/banner.png) |\n\n### How to Bid",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "PATCH") {
          return new Response(
            JSON.stringify({ number: 42, html_url: "", title: "", body: "", state: "open", node_id: "" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/comments") && method === "POST") {
          return new Response(
            JSON.stringify({ id: 101, body: "", user: { login: "bot" }, created_at: "" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
      };

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(true);
        expect(result.message).toContain("rejected");
        expect(result.message).toContain("@testbidder");

        const updatedPeriod: PeriodData = JSON.parse(
          await Bun.file(resolve(rejectDataDir, "current-period.json")).text(),
        );
        expect(updatedPeriod.bids[0]!.status).toBe("rejected");
      } finally {
        globalThis.fetch = origFetch;
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        else delete process.env["GITHUB_REPOSITORY_OWNER"];
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        else delete process.env["GITHUB_REPOSITORY"];
        if (origToken) process.env["GITHUB_TOKEN"] = origToken;
        else delete process.env["GITHUB_TOKEN"];
        process.chdir(originalCwd);
      }
    });

    test("returns error when no owner reaction found", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const noReactDir = resolve(tempDir, "noreact");
      const noReactDataDir = resolve(noReactDir, "data");
      await mkdir(noReactDataDir, { recursive: true });
      await Bun.write(
        resolve(noReactDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(noReactDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([{ id: 1, content: "+1", user: { login: "someoneelse" } }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(false);
        expect(result.message).toContain("No reaction from repository owner");
      } finally {
        globalThis.fetch = origFetch;
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        else delete process.env["GITHUB_REPOSITORY_OWNER"];
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        else delete process.env["GITHUB_REPOSITORY"];
        if (origToken) process.env["GITHUB_TOKEN"] = origToken;
        else delete process.env["GITHUB_TOKEN"];
        process.chdir(originalCwd);
      }
    });

    test("returns error for unrecognized reaction", async () => {
      const { processApproval } = await import("../scripts/approval-processor");

      const weirdDir = resolve(tempDir, "weird");
      const weirdDataDir = resolve(weirdDir, "data");
      await mkdir(weirdDataDir, { recursive: true });
      await Bun.write(
        resolve(weirdDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(weirdDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([{ id: 1, content: "heart", user: { login: "repoowner" } }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      try {
        const result = await processApproval(42, 555);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Unrecognized reaction");
        expect(result.message).toContain("heart");
      } finally {
        globalThis.fetch = origFetch;
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        else delete process.env["GITHUB_REPOSITORY_OWNER"];
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        else delete process.env["GITHUB_REPOSITORY"];
        if (origToken) process.env["GITHUB_TOKEN"] = origToken;
        else delete process.env["GITHUB_TOKEN"];
        process.chdir(originalCwd);
      }
    });
  });

  describe("CLI", () => {
    test("shows usage error with missing arguments", async () => {
      const proc = Bun.spawn(
        [
          "bun",
          "run",
          resolve(import.meta.dir, "../scripts/approval-processor.ts"),
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

    test("runs via bun with valid arguments", async () => {
      const proc = Bun.spawn(
        [
          "bun",
          "run",
          resolve(import.meta.dir, "../scripts/approval-processor.ts"),
          "42",
          "555",
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
      expect(output).toContain("BidMe: Processing Approval");
      expect(output).toContain("Issue: #42");
      expect(output).toContain("Comment: 555");
    });
  });
});
