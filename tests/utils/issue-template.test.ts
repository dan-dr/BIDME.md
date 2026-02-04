import { describe, test, expect } from "bun:test";
import type { PeriodData, BidRecord } from "../../scripts/bid-opener";
import type { BidMeConfig } from "../../scripts/utils/config";

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
  bids: [],
  ...overrides,
});

const makeConfig = (overrides?: Partial<BidMeConfig>): BidMeConfig => ({
  bidding: {
    schedule: "monthly",
    duration: 7,
    minimum_bid: 50,
    increment: 5,
  },
  banner: {
    width: 800,
    height: 100,
    format: "png,jpg,svg",
    max_size: 200,
    position: "top",
  },
  content_guidelines: {
    prohibited: ["adult content", "gambling", "misleading claims"],
    required: ["alt text", "clear branding"],
  },
  analytics: {
    display: true,
    metrics: ["views", "countries", "referrers", "clicks"],
  },
  ...overrides,
});

describe("issue-template", () => {
  describe("generateBidTable", () => {
    test("returns empty table with 0 bids", async () => {
      const { generateBidTable } = await import(
        "../../scripts/utils/issue-template"
      );
      const table = generateBidTable([]);
      expect(table).toContain("No bids yet");
      expect(table).toContain("| Rank |");
      expect(table).toContain("|------|");
    });

    test("generates table with 1 bid", async () => {
      const { generateBidTable } = await import(
        "../../scripts/utils/issue-template"
      );
      const table = generateBidTable([makeBid()]);
      expect(table).toContain("@testbidder");
      expect(table).toContain("$100");
      expect(table).toContain("⏳ pending");
      expect(table).toContain("[preview]");
      expect(table).not.toContain("No bids yet");
    });

    test("sorts multiple bids by amount descending", async () => {
      const { generateBidTable } = await import(
        "../../scripts/utils/issue-template"
      );
      const bids = [
        makeBid({ bidder: "low", amount: 50, comment_id: 1 }),
        makeBid({ bidder: "high", amount: 200, comment_id: 2, status: "approved" }),
        makeBid({ bidder: "mid", amount: 100, comment_id: 3 }),
      ];
      const table = generateBidTable(bids);
      const lines = table.split("\n");
      const dataRows = lines.filter((l) => l.includes("@"));
      expect(dataRows[0]).toContain("@high");
      expect(dataRows[0]).toContain("$200");
      expect(dataRows[1]).toContain("@mid");
      expect(dataRows[1]).toContain("$100");
      expect(dataRows[2]).toContain("@low");
      expect(dataRows[2]).toContain("$50");
    });

    test("shows correct status emoji for each state", async () => {
      const { generateBidTable } = await import(
        "../../scripts/utils/issue-template"
      );
      const bids = [
        makeBid({ bidder: "a", amount: 150, status: "approved", comment_id: 1 }),
        makeBid({ bidder: "p", amount: 100, status: "pending", comment_id: 2 }),
        makeBid({ bidder: "r", amount: 75, status: "rejected", comment_id: 3 }),
      ];
      const table = generateBidTable(bids);
      expect(table).toContain("✅ approved");
      expect(table).toContain("⏳ pending");
      expect(table).toContain("❌ rejected");
    });

    test("assigns rank numbers correctly", async () => {
      const { generateBidTable } = await import(
        "../../scripts/utils/issue-template"
      );
      const bids = [
        makeBid({ bidder: "first", amount: 200, comment_id: 1 }),
        makeBid({ bidder: "second", amount: 100, comment_id: 2 }),
      ];
      const table = generateBidTable(bids);
      expect(table).toContain("| 1 | @first");
      expect(table).toContain("| 2 | @second");
    });
  });

  describe("generateBiddingIssueBody", () => {
    test("produces valid markdown with all sections", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const config = makeConfig();
      const body = generateBiddingIssueBody(period, config, []);

      expect(body).toContain("## 🎯 BidMe Banner Bidding");
      expect(body).toContain("### Rules");
      expect(body).toContain("$50");
      expect(body).toContain("$5");
      expect(body).toContain("png, jpg, svg");
      expect(body).toContain("800x100px");
      expect(body).toContain("200KB");
      expect(body).toContain("### Current Status");
      expect(body).toContain("### How to Bid");
      expect(body).toContain("```yaml");
      expect(body).toContain("### Deadline");
      expect(body).toContain("Powered by");
    });

    test("includes bid table when bids are present", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const config = makeConfig();
      const bids = [makeBid({ bidder: "alice", amount: 100 })];
      const body = generateBiddingIssueBody(period, config, bids);

      expect(body).toContain("@alice");
      expect(body).toContain("$100");
      expect(body).not.toContain("No bids yet");
    });

    test("shows empty table when no bids", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const config = makeConfig();
      const body = generateBiddingIssueBody(period, config, []);

      expect(body).toContain("No bids yet");
    });

    test("shows deadline countdown", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const period = makePeriodData({ end_date: future.toISOString() });
      const config = makeConfig();
      const body = generateBiddingIssueBody(period, config, []);

      expect(body).toContain("remaining");
    });

    test("shows ended message for past deadline", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const past = new Date("2020-01-01T00:00:00.000Z");
      const period = makePeriodData({ end_date: past.toISOString() });
      const config = makeConfig();
      const body = generateBiddingIssueBody(period, config, []);

      expect(body).toContain("Bidding has ended");
    });

    test("uses config values for rules", async () => {
      const { generateBiddingIssueBody } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const config = makeConfig({
        bidding: { schedule: "weekly", duration: 3, minimum_bid: 25, increment: 10 },
        banner: { width: 600, height: 200, format: "gif,webp", max_size: 500, position: "bottom" },
      });
      const body = generateBiddingIssueBody(period, config, []);

      expect(body).toContain("$25");
      expect(body).toContain("$10");
      expect(body).toContain("gif, webp");
      expect(body).toContain("600x200px");
      expect(body).toContain("500KB");
    });
  });

  describe("generateWinnerAnnouncement", () => {
    test("produces markdown with winner details", async () => {
      const { generateWinnerAnnouncement } = await import(
        "../../scripts/utils/issue-template"
      );
      const bid = makeBid({ bidder: "winner", amount: 150, status: "approved" });
      const period = makePeriodData();
      const comment = generateWinnerAnnouncement(bid, period);

      expect(comment).toContain("@winner");
      expect(comment).toContain("$150");
      expect(comment).toContain("2026-02-04");
      expect(comment).toContain("2026-02-11");
      expect(comment).toContain("Winner Announced");
      expect(comment).toContain(bid.banner_url);
      expect(comment).toContain(bid.destination_url);
      expect(comment).toContain("Powered by");
    });

    test("includes congratulations and details table", async () => {
      const { generateWinnerAnnouncement } = await import(
        "../../scripts/utils/issue-template"
      );
      const bid = makeBid({ bidder: "champion", amount: 500, status: "approved" });
      const period = makePeriodData();
      const comment = generateWinnerAnnouncement(bid, period);

      expect(comment).toContain("Congratulations");
      expect(comment).toContain("| Detail | Value |");
      expect(comment).toContain("| Winner | @champion |");
      expect(comment).toContain("| Amount | $500 |");
    });
  });

  describe("generateNoBidsMessage", () => {
    test("produces markdown with period dates", async () => {
      const { generateNoBidsMessage } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const comment = generateNoBidsMessage(period);

      expect(comment).toContain("No Winner");
      expect(comment).toContain("2026-02-04");
      expect(comment).toContain("2026-02-11");
      expect(comment).toContain("no approved bids");
      expect(comment).toContain("Powered by");
    });

    test("mentions new cycle will open", async () => {
      const { generateNoBidsMessage } = await import(
        "../../scripts/utils/issue-template"
      );
      const period = makePeriodData();
      const comment = generateNoBidsMessage(period);

      expect(comment).toContain("new bidding period");
    });
  });
});
