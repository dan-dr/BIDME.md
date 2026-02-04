import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import type { PeriodData } from "../bid-opener.ts";

const OWNER = "test-owner";
const REPO = "test-repo";
const MOCK_TOKEN = "ghp_e2e_test_token";

let tempDir: string;
let dataDir: string;
let archiveDir: string;
let configPath: string;
let periodDataPath: string;
let readmePath: string;
let originalCwd: string;
let originalFetch: typeof globalThis.fetch;
let originalEnv: Record<string, string | undefined>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchCalls: Array<{ url: string; method: string; body?: any }> = [];

const issueState = {
  number: 42,
  html_url: `https://github.com/${OWNER}/${REPO}/issues/42`,
  title: "🎯 BidMe: Banner Bidding [test]",
  body: "## 🎯 BidMe Banner Bidding\n\n### Rules\n\n### Current Status\n\n| Rank | Bidder | Amount | Status | Banner Preview |\n|------|--------|--------|--------|----------------|\n| — | No bids yet | — | — | — |\n\n### How to Bid\n\n### Deadline\n\n---\n*Powered by [BidMe](https://github.com/danarrib/bidme)*",
  state: "open" as string,
  node_id: "I_kgDOtest42",
  pinned: false,
  closed: false,
};

const comments: Array<{ id: number; body: string; user: { login: string }; created_at: string }> = [];
const reactions: Record<number, Array<{ id: number; content: string; user: { login: string } }>> = {};
let readmeContent = "# Test Repo\n\n<!-- BIDME:BANNER:START -->\n<!-- BIDME:BANNER:END -->\n\nHello world!";
let readmeSha = "sha_readme_original";

function setupMockFetch() {
  globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    fetchCalls.push({ url: urlStr, method, body });

    // GraphQL (pin/unpin) — check unpinIssue first since "unpinIssue" contains "pinIssue"
    if (urlStr.includes("/graphql")) {
      if (body?.query?.includes("unpinIssue")) {
        issueState.pinned = false;
        return new Response(JSON.stringify({ data: { unpinIssue: { issue: { id: issueState.node_id } } } }), { status: 200 });
      }
      if (body?.query?.includes("pinIssue")) {
        issueState.pinned = true;
        return new Response(JSON.stringify({ data: { pinIssue: { issue: { id: issueState.node_id } } } }), { status: 200 });
      }
    }

    const repoBase = `https://api.github.com/repos/${OWNER}/${REPO}`;

    // Create issue
    if (urlStr === `${repoBase}/issues` && method === "POST") {
      issueState.title = body.title;
      issueState.body = body.body;
      issueState.state = "open";
      return new Response(JSON.stringify({ ...issueState }), { status: 201 });
    }

    // Get issue
    if (urlStr === `${repoBase}/issues/${issueState.number}` && method === "GET") {
      return new Response(JSON.stringify({ ...issueState }), { status: 200 });
    }

    // Update issue body
    if (urlStr === `${repoBase}/issues/${issueState.number}` && method === "PATCH") {
      if (body.body !== undefined) issueState.body = body.body;
      if (body.state !== undefined) {
        issueState.state = body.state;
        issueState.closed = body.state === "closed";
      }
      return new Response(JSON.stringify({ ...issueState }), { status: 200 });
    }

    // Add comment
    if (urlStr === `${repoBase}/issues/${issueState.number}/comments` && method === "POST") {
      const commentId = 1000 + comments.length;
      const comment = {
        id: commentId,
        body: body.body,
        user: { login: "bidme-bot" },
        created_at: new Date().toISOString(),
      };
      comments.push(comment);
      return new Response(JSON.stringify(comment), { status: 201 });
    }

    // Get comment by ID
    const commentMatch = urlStr.match(new RegExp(`${repoBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/issues/comments/(\\d+)$`));
    if (commentMatch && method === "GET") {
      const cid = parseInt(commentMatch[1]!, 10);
      const comment = comments.find((c) => c.id === cid);
      if (comment) {
        return new Response(JSON.stringify(comment), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }

    // Get reactions on comment
    const reactionsMatch = urlStr.match(new RegExp(`${repoBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/issues/comments/(\\d+)/reactions$`));
    if (reactionsMatch && method === "GET") {
      const cid = parseInt(reactionsMatch[1]!, 10);
      return new Response(JSON.stringify(reactions[cid] ?? []), { status: 200 });
    }

    // Get README content
    if (urlStr === `${repoBase}/contents/README.md` && method === "GET") {
      return new Response(JSON.stringify({ sha: readmeSha, content: btoa(readmeContent) }), { status: 200 });
    }

    // Update README
    if (urlStr === `${repoBase}/contents/README.md` && method === "PUT") {
      readmeContent = atob(body.content);
      readmeSha = "sha_readme_updated";
      return new Response(JSON.stringify({
        content: { sha: readmeSha },
        commit: { sha: "commit_updated", html_url: `https://github.com/${OWNER}/${REPO}/commit/commit_updated` },
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  }) as unknown as typeof fetch;
}

beforeAll(async () => {
  tempDir = await mkdtemp(resolve(tmpdir(), "bidme-e2e-"));
  dataDir = resolve(tempDir, "data");
  archiveDir = resolve(dataDir, "archive");
  await mkdir(dataDir, { recursive: true });
  configPath = resolve(tempDir, "bidme-config.yml");
  periodDataPath = resolve(dataDir, "current-period.json");
  readmePath = resolve(tempDir, "README.md");

  await Bun.write(configPath, [
    "bidding:",
    "  schedule: monthly",
    "  duration: 7",
    "  minimum_bid: 50",
    "  increment: 5",
    "banner:",
    "  width: 800",
    "  height: 100",
    '  format: "png,jpg,svg"',
    "  max_size: 200",
    '  position: "top"',
  ].join("\n"));

  await Bun.write(readmePath, readmeContent);
});

afterAll(async () => {
  await rm(tempDir, { recursive: true });
});

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalCwd = process.cwd();
  originalEnv = {
    GITHUB_TOKEN: process.env["GITHUB_TOKEN"],
    GITHUB_REPOSITORY_OWNER: process.env["GITHUB_REPOSITORY_OWNER"],
    GITHUB_REPOSITORY: process.env["GITHUB_REPOSITORY"],
    POLAR_ACCESS_TOKEN: process.env["POLAR_ACCESS_TOKEN"],
  };

  process.env["GITHUB_TOKEN"] = MOCK_TOKEN;
  process.env["GITHUB_REPOSITORY_OWNER"] = OWNER;
  process.env["GITHUB_REPOSITORY"] = `${OWNER}/${REPO}`;
  delete process.env["POLAR_ACCESS_TOKEN"];

  process.chdir(tempDir);
  fetchCalls.length = 0;
  setupMockFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.chdir(originalCwd);
  for (const [key, val] of Object.entries(originalEnv)) {
    if (val !== undefined) {
      process.env[key] = val;
    } else {
      delete process.env[key];
    }
  }
});

describe("E2E: Full Bidding Lifecycle", () => {
  test("Step 1: Open bidding period → creates issue, pins it, saves period data", async () => {
    const { openBiddingPeriod } = await import("../bid-opener.ts");
    await openBiddingPeriod(configPath);

    const periodFile = Bun.file(periodDataPath);
    expect(await periodFile.exists()).toBe(true);
    const periodData: PeriodData = JSON.parse(await periodFile.text());

    expect(periodData.status).toBe("open");
    expect(periodData.bids).toEqual([]);
    expect(periodData.issue_number).toBe(issueState.number);
    expect(periodData.issue_node_id).toBe(issueState.node_id);
    expect(periodData.period_id).toMatch(/^period-\d{4}-\d{2}-\d{2}$/);

    const start = new Date(periodData.start_date);
    const end = new Date(periodData.end_date);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);

    const createCalls = fetchCalls.filter((c) => c.url.endsWith("/issues") && c.method === "POST");
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]!.body.title).toContain("BidMe: Banner Bidding");

    const pinCalls = fetchCalls.filter((c) => c.url.includes("/graphql") && c.body?.query?.includes("pinIssue"));
    expect(pinCalls).toHaveLength(1);
    expect(issueState.pinned).toBe(true);
  });

  test("Step 2: Process a valid bid → bid added to period data, issue body updated", async () => {
    // Seed period data from step 1
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const periodData: PeriodData = {
      period_id: `period-${now.toISOString().split("T")[0]}`,
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      issue_number: issueState.number,
      issue_node_id: issueState.node_id,
      status: "open",
      bids: [],
    };
    await Bun.write(periodDataPath, JSON.stringify(periodData, null, 2));

    // Simulate a bid comment
    const bidComment = {
      id: 2001,
      body: "```yaml\namount: 100\nbanner_url: https://example.com/banner.png\ndestination_url: https://example.com\ncontact: bidder1@test.com\n```",
      user: { login: "bidder1" },
      created_at: new Date().toISOString(),
    };
    comments.push(bidComment);

    const { processBid } = await import("../bid-processor.ts");
    const result = await processBid(issueState.number, 2001, configPath);

    expect(result.success).toBe(true);
    expect(result.message).toContain("$100");
    expect(result.message).toContain("bidder1");

    const updatedPeriod: PeriodData = JSON.parse(await Bun.file(periodDataPath).text());
    expect(updatedPeriod.bids).toHaveLength(1);
    expect(updatedPeriod.bids[0]!.bidder).toBe("bidder1");
    expect(updatedPeriod.bids[0]!.amount).toBe(100);
    expect(updatedPeriod.bids[0]!.status).toBe("pending");
    expect(updatedPeriod.bids[0]!.banner_url).toBe("https://example.com/banner.png");
    expect(updatedPeriod.bids[0]!.destination_url).toBe("https://example.com");
    expect(updatedPeriod.bids[0]!.contact).toBe("bidder1@test.com");
    expect(updatedPeriod.bids[0]!.comment_id).toBe(2001);

    // Verify issue body was updated via PATCH
    const patchCalls = fetchCalls.filter((c) => c.url.includes(`/issues/${issueState.number}`) && c.method === "PATCH");
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);

    // Verify confirmation comment was posted
    const confirmComment = comments.find((c) => c.body.includes("Bid accepted"));
    expect(confirmComment).toBeDefined();
  });

  test("Step 3: Process an invalid bid (below minimum) → rejection comment posted", async () => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const periodData: PeriodData = {
      period_id: `period-${now.toISOString().split("T")[0]}`,
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      issue_number: issueState.number,
      issue_node_id: issueState.node_id,
      status: "open",
      bids: [{
        bidder: "bidder1",
        amount: 100,
        banner_url: "https://example.com/banner.png",
        destination_url: "https://example.com",
        contact: "bidder1@test.com",
        status: "pending",
        comment_id: 2001,
        timestamp: new Date().toISOString(),
      }],
    };
    await Bun.write(periodDataPath, JSON.stringify(periodData, null, 2));

    const lowBidComment = {
      id: 2002,
      body: "```yaml\namount: 30\nbanner_url: https://example.com/cheap.png\ndestination_url: https://cheap.com\ncontact: cheapo@test.com\n```",
      user: { login: "cheapbidder" },
      created_at: new Date().toISOString(),
    };
    comments.push(lowBidComment);

    const { processBid } = await import("../bid-processor.ts");
    const result = await processBid(issueState.number, 2002, configPath);

    expect(result.success).toBe(false);
    expect(result.message).toContain("at least $50");

    // Period data should NOT have the invalid bid
    const unchangedPeriod: PeriodData = JSON.parse(await Bun.file(periodDataPath).text());
    expect(unchangedPeriod.bids).toHaveLength(1);
    expect(unchangedPeriod.bids[0]!.bidder).toBe("bidder1");

    // Rejection comment should be posted
    const rejectionComment = comments.find((c) => c.body.includes("Bid rejected"));
    expect(rejectionComment).toBeDefined();
  });

  test("Step 4: Process a second higher bid → becomes new highest", async () => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const periodData: PeriodData = {
      period_id: `period-${now.toISOString().split("T")[0]}`,
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      issue_number: issueState.number,
      issue_node_id: issueState.node_id,
      status: "open",
      bids: [{
        bidder: "bidder1",
        amount: 100,
        banner_url: "https://example.com/banner.png",
        destination_url: "https://example.com",
        contact: "bidder1@test.com",
        status: "pending",
        comment_id: 2001,
        timestamp: new Date().toISOString(),
      }],
    };
    await Bun.write(periodDataPath, JSON.stringify(periodData, null, 2));

    const higherBidComment = {
      id: 2003,
      body: "```yaml\namount: 200\nbanner_url: https://premium.com/banner.png\ndestination_url: https://premium.com\ncontact: premium@test.com\n```",
      user: { login: "bigspender" },
      created_at: new Date().toISOString(),
    };
    comments.push(higherBidComment);

    const { processBid } = await import("../bid-processor.ts");
    const result = await processBid(issueState.number, 2003, configPath);

    expect(result.success).toBe(true);
    expect(result.message).toContain("$200");
    expect(result.message).toContain("bigspender");

    const updatedPeriod: PeriodData = JSON.parse(await Bun.file(periodDataPath).text());
    expect(updatedPeriod.bids).toHaveLength(2);

    const amounts = updatedPeriod.bids.map((b) => b.amount);
    expect(amounts).toContain(100);
    expect(amounts).toContain(200);

    const highest = updatedPeriod.bids.reduce((max, b) => b.amount > max.amount ? b : max);
    expect(highest.bidder).toBe("bigspender");
    expect(highest.amount).toBe(200);
  });

  test("Step 5: Approve the highest bid (owner emoji reaction) → status changed to approved", async () => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const periodData: PeriodData = {
      period_id: `period-${now.toISOString().split("T")[0]}`,
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      issue_number: issueState.number,
      issue_node_id: issueState.node_id,
      status: "open",
      bids: [
        {
          bidder: "bidder1",
          amount: 100,
          banner_url: "https://example.com/banner.png",
          destination_url: "https://example.com",
          contact: "bidder1@test.com",
          status: "pending",
          comment_id: 2001,
          timestamp: new Date().toISOString(),
        },
        {
          bidder: "bigspender",
          amount: 200,
          banner_url: "https://premium.com/banner.png",
          destination_url: "https://premium.com",
          contact: "premium@test.com",
          status: "pending",
          comment_id: 2003,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await Bun.write(periodDataPath, JSON.stringify(periodData, null, 2));

    // Mock owner's +1 reaction on comment 2003 (bigspender's bid)
    reactions[2003] = [{ id: 1, content: "+1", user: { login: OWNER } }];

    const { processApproval } = await import("../approval-processor.ts");
    const result = await processApproval(issueState.number, 2003);

    expect(result.success).toBe(true);
    expect(result.message).toContain("bigspender");
    expect(result.message).toContain("$200");
    expect(result.message).toContain("approved");

    const updatedPeriod: PeriodData = JSON.parse(await Bun.file(periodDataPath).text());
    const approvedBid = updatedPeriod.bids.find((b) => b.comment_id === 2003);
    expect(approvedBid).toBeDefined();
    expect(approvedBid!.status).toBe("approved");

    // bidder1 should still be pending
    const pendingBid = updatedPeriod.bids.find((b) => b.comment_id === 2001);
    expect(pendingBid).toBeDefined();
    expect(pendingBid!.status).toBe("pending");

    // Confirmation comment should be posted
    const approvalComment = comments.find((c) => c.body.includes("Bid approved"));
    expect(approvalComment).toBeDefined();
  });

  test("Step 6: Close bidding → README updated with winner banner, issue unpinned, issue closed, period archived", async () => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    const startDateStr = now.toISOString().split("T")[0];
    const periodData: PeriodData = {
      period_id: `period-${startDateStr}`,
      start_date: now.toISOString(),
      end_date: end.toISOString(),
      issue_number: issueState.number,
      issue_node_id: issueState.node_id,
      status: "open",
      bids: [
        {
          bidder: "bidder1",
          amount: 100,
          banner_url: "https://example.com/banner.png",
          destination_url: "https://example.com",
          contact: "bidder1@test.com",
          status: "pending",
          comment_id: 2001,
          timestamp: new Date().toISOString(),
        },
        {
          bidder: "bigspender",
          amount: 200,
          banner_url: "https://premium.com/banner.png",
          destination_url: "https://premium.com",
          contact: "premium@test.com",
          status: "approved",
          comment_id: 2003,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await Bun.write(periodDataPath, JSON.stringify(periodData, null, 2));

    // Reset issue state for close
    issueState.pinned = true;
    issueState.state = "open";
    issueState.closed = false;

    // Ensure README has markers
    readmeContent = "# Test Repo\n\n<!-- BIDME:BANNER:START -->\n<!-- BIDME:BANNER:END -->\n\nHello world!";

    const { closeBiddingPeriod } = await import("../bid-closer.ts");
    const result = await closeBiddingPeriod();

    expect(result.success).toBe(true);
    expect(result.message).toContain("bigspender");
    expect(result.message).toContain("$200");

    // README should contain the winner's banner
    expect(readmeContent).toContain("premium.com/banner.png");
    expect(readmeContent).toContain("premium.com");
    expect(readmeContent).toContain("BIDME:BANNER:START");
    expect(readmeContent).toContain("BIDME:BANNER:END");

    // Issue should be unpinned
    const unpinCalls = fetchCalls.filter((c) => c.url.includes("/graphql") && c.body?.query?.includes("unpinIssue"));
    expect(unpinCalls).toHaveLength(1);
    expect(issueState.pinned).toBe(false);

    // Issue should be closed
    const closeCalls = fetchCalls.filter((c) =>
      c.url.includes(`/issues/${issueState.number}`) &&
      c.method === "PATCH" &&
      c.body?.state === "closed"
    );
    expect(closeCalls).toHaveLength(1);
    expect(issueState.closed).toBe(true);

    // Period should be archived
    const archivePath = resolve(archiveDir, `period-${startDateStr}.json`);
    const archiveFile = Bun.file(archivePath);
    expect(await archiveFile.exists()).toBe(true);
    const archivedData: PeriodData = JSON.parse(await archiveFile.text());
    expect(archivedData.status).toBe("closed");
    expect(archivedData.bids).toHaveLength(2);
    expect(archivedData.period_id).toBe(`period-${startDateStr}`);

    // Winner announcement should be posted
    const winnerComment = comments.find((c) => c.body.includes("Winner Announced"));
    expect(winnerComment).toBeDefined();
  });

  test("Full lifecycle in sequence → data integrity at each step", async () => {
    // Reset state
    comments.length = 0;
    issueState.pinned = false;
    issueState.state = "open";
    issueState.closed = false;
    readmeContent = "# Test Repo\n\n<!-- BIDME:BANNER:START -->\n<!-- BIDME:BANNER:END -->\n\nHello world!";

    // Step 1: Open
    const { openBiddingPeriod } = await import("../bid-opener.ts");
    await openBiddingPeriod(configPath);

    let period: PeriodData = JSON.parse(await Bun.file(periodDataPath).text());
    expect(period.status).toBe("open");
    expect(period.bids).toHaveLength(0);
    expect(period.issue_number).toBe(issueState.number);
    expect(issueState.pinned).toBe(true);

    // Step 2: Valid bid
    const bid1Comment = {
      id: 3001,
      body: "```yaml\namount: 75\nbanner_url: https://brand.com/logo.png\ndestination_url: https://brand.com\ncontact: brand@test.com\n```",
      user: { login: "brand-user" },
      created_at: new Date().toISOString(),
    };
    comments.push(bid1Comment);

    const { processBid } = await import("../bid-processor.ts");
    let bidResult = await processBid(issueState.number, 3001, configPath);
    expect(bidResult.success).toBe(true);

    period = JSON.parse(await Bun.file(periodDataPath).text());
    expect(period.bids).toHaveLength(1);
    expect(period.bids[0]!.amount).toBe(75);

    // Step 3: Invalid bid (below minimum)
    const lowBid = {
      id: 3002,
      body: "```yaml\namount: 10\nbanner_url: https://low.com/ad.png\ndestination_url: https://low.com\ncontact: low@test.com\n```",
      user: { login: "cheapster" },
      created_at: new Date().toISOString(),
    };
    comments.push(lowBid);

    bidResult = await processBid(issueState.number, 3002, configPath);
    expect(bidResult.success).toBe(false);

    period = JSON.parse(await Bun.file(periodDataPath).text());
    expect(period.bids).toHaveLength(1); // unchanged

    // Step 4: Higher bid
    const bid2Comment = {
      id: 3003,
      body: "```yaml\namount: 150\nbanner_url: https://bigbrand.com/ad.png\ndestination_url: https://bigbrand.com\ncontact: ceo@bigbrand.com\n```",
      user: { login: "bigbrand" },
      created_at: new Date().toISOString(),
    };
    comments.push(bid2Comment);

    bidResult = await processBid(issueState.number, 3003, configPath);
    expect(bidResult.success).toBe(true);

    period = JSON.parse(await Bun.file(periodDataPath).text());
    expect(period.bids).toHaveLength(2);
    const highest = period.bids.reduce((max, b) => b.amount > max.amount ? b : max);
    expect(highest.amount).toBe(150);
    expect(highest.bidder).toBe("bigbrand");

    // Step 5: Approve highest bid
    reactions[3003] = [{ id: 10, content: "+1", user: { login: OWNER } }];

    const { processApproval } = await import("../approval-processor.ts");
    const approvalResult = await processApproval(issueState.number, 3003);
    expect(approvalResult.success).toBe(true);

    period = JSON.parse(await Bun.file(periodDataPath).text());
    const approved = period.bids.find((b) => b.comment_id === 3003);
    expect(approved!.status).toBe("approved");

    // Step 6: Close
    const { closeBiddingPeriod } = await import("../bid-closer.ts");
    const closeResult = await closeBiddingPeriod();
    expect(closeResult.success).toBe(true);
    expect(closeResult.message).toContain("bigbrand");

    // Verify final state
    expect(readmeContent).toContain("bigbrand.com/ad.png");
    expect(issueState.pinned).toBe(false);
    expect(issueState.closed).toBe(true);

    // Verify archive
    const dateStr = period.start_date.split("T")[0];
    const archivePath = resolve(archiveDir, `period-${dateStr}.json`);
    const archived: PeriodData = JSON.parse(await Bun.file(archivePath).text());
    expect(archived.status).toBe("closed");
    expect(archived.bids).toHaveLength(2);
  });
});
