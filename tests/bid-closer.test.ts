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
  bids: [makeBid({ status: "approved" })],
  ...overrides,
});

const sampleReadme = `![Build Status](https://img.shields.io/badge/build-passing-green)

<!-- BIDME:BANNER:START -->
[![BidMe Banner](https://img.shields.io/badge/Your_Ad_Here-BidMe-22c55e)](https://github.com/danhollick/bidme)
<!-- BIDME:BANNER:END -->

# BidMe

Some content here.`;

describe("bid-closer", () => {
  let tempDir: string;
  let dataDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-closer-"));
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
    await Bun.write(resolve(tempDir, "README.md"), sampleReadme);
  });

  describe("closeBiddingPeriod", () => {
    test("returns error when no period file exists", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const emptyDir = resolve(tempDir, "empty");
      await mkdir(resolve(emptyDir, "data"), { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(emptyDir);

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(false);
        expect(result.message).toContain("No active bidding period");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("returns error when period is already closed", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

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
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(false);
        expect(result.message).toContain("not open");
      } finally {
        process.chdir(originalCwd);
      }
    });

    test("closes with winner in local mode (no GitHub env)", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const localDir = resolve(tempDir, "local-winner");
      const localDataDir = resolve(localDir, "data");
      await mkdir(localDataDir, { recursive: true });
      await Bun.write(
        resolve(localDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(localDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(true);
        expect(result.message).toContain("winner");
        expect(result.message).toContain("@testbidder");
        expect(result.message).toContain("$100");

        const updatedPeriod: PeriodData = JSON.parse(
          await Bun.file(resolve(localDataDir, "current-period.json")).text(),
        );
        expect(updatedPeriod.status).toBe("closed");

        const archiveFile = Bun.file(
          resolve(localDataDir, "archive/period-2026-02-04.json"),
        );
        expect(await archiveFile.exists()).toBe(true);
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });

    test("closes with no winner in local mode", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const localDir = resolve(tempDir, "local-nowinner");
      const localDataDir = resolve(localDir, "data");
      await mkdir(localDataDir, { recursive: true });
      await Bun.write(
        resolve(localDataDir, "current-period.json"),
        JSON.stringify(makePeriodData({ bids: [] }), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(localDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(true);
        expect(result.message).toContain("no winner");
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });

    test("selects highest approved bid as winner (ignoring pending/rejected)", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const localDir = resolve(tempDir, "local-multi");
      const localDataDir = resolve(localDir, "data");
      await mkdir(localDataDir, { recursive: true });

      const bids: BidRecord[] = [
        makeBid({ bidder: "low", amount: 50, status: "approved", comment_id: 1 }),
        makeBid({ bidder: "high", amount: 200, status: "approved", comment_id: 2 }),
        makeBid({ bidder: "highest-pending", amount: 300, status: "pending", comment_id: 3 }),
        makeBid({ bidder: "rejected", amount: 250, status: "rejected", comment_id: 4 }),
      ];

      await Bun.write(
        resolve(localDataDir, "current-period.json"),
        JSON.stringify(makePeriodData({ bids }), null, 2),
      );

      const originalCwd = process.cwd();
      process.chdir(localDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      delete process.env["GITHUB_REPOSITORY_OWNER"];
      delete process.env["GITHUB_REPOSITORY"];

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(true);
        expect(result.message).toContain("@high");
        expect(result.message).toContain("$200");
      } finally {
        if (origOwner) process.env["GITHUB_REPOSITORY_OWNER"] = origOwner;
        if (origRepo) process.env["GITHUB_REPOSITORY"] = origRepo;
        process.chdir(originalCwd);
      }
    });

    test("closes with winner via GitHub API — updates README, comments, unpins, closes", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const ghDir = resolve(tempDir, "gh-winner");
      const ghDataDir = resolve(ghDir, "data");
      await mkdir(ghDataDir, { recursive: true });
      await Bun.write(
        resolve(ghDataDir, "current-period.json"),
        JSON.stringify(makePeriodData(), null, 2),
      );
      await Bun.write(resolve(ghDir, "README.md"), sampleReadme);

      const originalCwd = process.cwd();
      process.chdir(ghDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;
      const calls: { url: string; method: string; body?: string }[] = [];

      globalThis.fetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = init?.method ?? "GET";
        const body = init?.body ? String(init.body) : undefined;
        calls.push({ url, method, body });

        if (url.includes("/contents/README.md") && method === "GET") {
          return new Response(
            JSON.stringify({
              sha: "abc123sha",
              content: btoa(sampleReadme),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/contents/README.md") && method === "PUT") {
          return new Response(
            JSON.stringify({
              content: { sha: "newsha" },
              commit: {
                sha: "commitsha",
                html_url: "https://github.com/repoowner/testrepo/commit/commitsha",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/comments") && method === "POST") {
          return new Response(
            JSON.stringify({
              id: 200,
              body: "",
              user: { login: "bot" },
              created_at: "",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "PATCH") {
          return new Response(
            JSON.stringify({
              number: 42,
              html_url: "",
              title: "",
              body: "",
              state: "closed",
              node_id: "I_abc123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/graphql")) {
          return new Response(
            JSON.stringify({ data: { unpinIssue: { issue: { id: "I_abc123" } } } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(true);
        expect(result.message).toContain("winner");
        expect(result.message).toContain("@testbidder");

        const readmeCall = calls.find(
          (c) => c.url.includes("/contents/README.md") && c.method === "PUT",
        );
        expect(readmeCall).toBeDefined();
        const readmeBody = JSON.parse(readmeCall!.body!);
        const decodedReadme = atob(readmeBody.content);
        expect(decodedReadme).toContain("example.com/banner.png");
        expect(decodedReadme).toContain("BIDME:BANNER:START");
        expect(decodedReadme).toContain("BIDME:BANNER:END");

        const commentCall = calls.find(
          (c) => c.url.includes("/comments") && c.method === "POST",
        );
        expect(commentCall).toBeDefined();
        const commentBody = JSON.parse(commentCall!.body!);
        expect(commentBody.body).toContain("Winner");
        expect(commentBody.body).toContain("@testbidder");

        const unpinCall = calls.find((c) => c.url.includes("/graphql") && c.body?.includes("unpinIssue"));
        expect(unpinCall).toBeDefined();

        const closeCall = calls.find(
          (c) =>
            c.url.includes("/issues/42") &&
            c.method === "PATCH" &&
            c.body?.includes("closed"),
        );
        expect(closeCall).toBeDefined();

        const periodFile = await Bun.file(
          resolve(ghDataDir, "current-period.json"),
        ).text();
        expect(periodFile).toBe("");

        const archiveFile = Bun.file(
          resolve(ghDataDir, "archive/period-2026-02-04.json"),
        );
        expect(await archiveFile.exists()).toBe(true);
        const archived: PeriodData = JSON.parse(await archiveFile.text());
        expect(archived.status).toBe("closed");
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

    test("closes with no approved bids via GitHub API — comments, unpins, closes", async () => {
      const { closeBiddingPeriod } = await import("../scripts/bid-closer");

      const ghDir = resolve(tempDir, "gh-nowinner");
      const ghDataDir = resolve(ghDir, "data");
      await mkdir(ghDataDir, { recursive: true });
      await Bun.write(
        resolve(ghDataDir, "current-period.json"),
        JSON.stringify(
          makePeriodData({
            bids: [makeBid({ status: "pending" }), makeBid({ status: "rejected", comment_id: 556 })],
          }),
          null,
          2,
        ),
      );

      const originalCwd = process.cwd();
      process.chdir(ghDir);

      const origOwner = process.env["GITHUB_REPOSITORY_OWNER"];
      const origRepo = process.env["GITHUB_REPOSITORY"];
      const origToken = process.env["GITHUB_TOKEN"];
      process.env["GITHUB_REPOSITORY_OWNER"] = "repoowner";
      process.env["GITHUB_REPOSITORY"] = "repoowner/testrepo";
      process.env["GITHUB_TOKEN"] = "test-token";

      const origFetch = globalThis.fetch;
      const calls: { url: string; method: string; body?: string }[] = [];

      globalThis.fetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = init?.method ?? "GET";
        const body = init?.body ? String(init.body) : undefined;
        calls.push({ url, method, body });

        if (url.includes("/comments") && method === "POST") {
          return new Response(
            JSON.stringify({
              id: 201,
              body: "",
              user: { login: "bot" },
              created_at: "",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/issues/42") && method === "PATCH") {
          return new Response(
            JSON.stringify({
              number: 42,
              html_url: "",
              title: "",
              body: "",
              state: "closed",
              node_id: "I_abc123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/graphql")) {
          return new Response(
            JSON.stringify({ data: { unpinIssue: { issue: { id: "I_abc123" } } } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        const result = await closeBiddingPeriod();
        expect(result.success).toBe(true);
        expect(result.message).toContain("no winner");

        const readmeCall = calls.find(
          (c) => c.url.includes("/contents/README.md"),
        );
        expect(readmeCall).toBeUndefined();

        const commentCall = calls.find(
          (c) => c.url.includes("/comments") && c.method === "POST",
        );
        expect(commentCall).toBeDefined();
        const commentBody = JSON.parse(commentCall!.body!);
        expect(commentBody.body).toContain("No Winner");

        const unpinCall = calls.find((c) => c.url.includes("/graphql"));
        expect(unpinCall).toBeDefined();

        const closeCall = calls.find(
          (c) =>
            c.url.includes("/issues/42") &&
            c.method === "PATCH" &&
            c.body?.includes("closed"),
        );
        expect(closeCall).toBeDefined();
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

  describe("generateWinnerComment", () => {
    test("produces markdown with winner details", async () => {
      const { generateWinnerComment } = await import("../scripts/bid-closer");

      const bid = makeBid({ bidder: "winner", amount: 150, status: "approved" });
      const period = makePeriodData();
      const comment = generateWinnerComment(bid, period);

      expect(comment).toContain("@winner");
      expect(comment).toContain("$150");
      expect(comment).toContain("2026-02-04");
      expect(comment).toContain("2026-02-11");
      expect(comment).toContain("Winner Announced");
      expect(comment).toContain(bid.banner_url);
      expect(comment).toContain(bid.destination_url);
    });
  });

  describe("generateNoWinnerComment", () => {
    test("produces markdown with period dates", async () => {
      const { generateNoWinnerComment } = await import("../scripts/bid-closer");

      const period = makePeriodData();
      const comment = generateNoWinnerComment(period);

      expect(comment).toContain("No Winner");
      expect(comment).toContain("2026-02-04");
      expect(comment).toContain("2026-02-11");
      expect(comment).toContain("no approved bids");
    });
  });

  describe("archivePeriod", () => {
    test("creates archive directory and writes period file", async () => {
      const { archivePeriod } = await import("../scripts/bid-closer");

      const archDir = resolve(tempDir, "archtest");
      const archDataDir = resolve(archDir, "data");
      await mkdir(archDataDir, { recursive: true });

      const originalCwd = process.cwd();
      process.chdir(archDir);

      try {
        const period = makePeriodData({ status: "closed" });
        await archivePeriod(period);

        const archiveFile = Bun.file(
          resolve(archDataDir, "archive/period-2026-02-04.json"),
        );
        expect(await archiveFile.exists()).toBe(true);

        const archived: PeriodData = JSON.parse(await archiveFile.text());
        expect(archived.period_id).toBe("period-2026-02-04");
        expect(archived.status).toBe("closed");
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("CLI", () => {
    test("shows error when run without GitHub environment", async () => {
      const proc = Bun.spawn(
        [
          "bun",
          "run",
          resolve(import.meta.dir, "../scripts/bid-closer.ts"),
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
      expect(output).toContain("BidMe: Closing Bidding Period");
    });
  });
});
