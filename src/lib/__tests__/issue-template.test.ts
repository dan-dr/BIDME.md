import { describe, expect, test } from "bun:test";
import type { BidMeConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../config.js";
import {
  generateBiddingIssueBody,
  generateBidIssueBody,
  generateBidTable,
  generateCurrentTopBid,
  generateNoBidsMessage,
  generatePreviousStatsSection,
  generateStatsSection,
  generateWinnerAnnouncement,
  updateBidIssueBody,
} from "../issue-template.js";
import type { BidRecord, PeriodAnalytics, PeriodData } from "../types.js";

function makePeriod(overrides: Partial<PeriodData> = {}): PeriodData {
  return {
    period_id: "period-2026-02-01",
    status: "open",
    start_date: "2026-02-01T00:00:00.000Z",
    end_date: "2026-02-08T00:00:00.000Z",
    issue_number: 42,
    issue_url: "https://github.com/owner/repo/issues/42",
    bids: [],
    created_at: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBid(overrides: Partial<BidRecord> = {}): BidRecord {
  return {
    bidder: "bidder1",
    amount: 100,
    banner_url: "https://example.com/banner.png",
    destination_url: "https://example.com",
    tagline: "Build faster",
    status: "active",
    comment_id: 1001,
    timestamp: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

function makeStats(overrides: Partial<PeriodAnalytics> = {}): PeriodAnalytics {
  return {
    period_id: "period-2026-01",
    views: 1500,
    clicks: 45,
    ctr: 3.0,
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: "2026-01-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("generateBidTable", () => {
  test("generates empty table when no bids", () => {
    const table = generateBidTable([]);
    expect(table).toContain("No bids yet");
    expect(table).toContain("| Rank | Bidder | Amount | Status | Tagline | Banner |");
  });

  test("generates table with bids sorted by amount descending", () => {
    const bids = [
      makeBid({ bidder: "low", amount: 50, comment_id: 1 }),
      makeBid({ bidder: "high", amount: 200, comment_id: 2 }),
      makeBid({ bidder: "mid", amount: 100, comment_id: 3 }),
    ];
    const table = generateBidTable(bids);

    const lines = table.split("\n");
    expect(lines[2]).toContain("@high");
    expect(lines[2]).toContain("$200");
    expect(lines[2]).toContain("| 1 |");
    expect(lines[3]).toContain("@mid");
    expect(lines[3]).toContain("$100");
    expect(lines[3]).toContain("| 2 |");
    expect(lines[4]).toContain("@low");
    expect(lines[4]).toContain("$50");
    expect(lines[4]).toContain("| 3 |");
  });

  test("shows competing bids with status labels and hides terminal ones", () => {
    const bids = [
      makeBid({ status: "active", comment_id: 1 }),
      makeBid({ status: "unlinked_pending", comment_id: 2, amount: 50, bidder: "pending-user" }),
      makeBid({ status: "rejected", comment_id: 3, amount: 25, bidder: "rejected-user" }),
      makeBid({ status: "expired", comment_id: 4, amount: 30, bidder: "expired-user" }),
    ];
    const table = generateBidTable(bids);
    expect(table).toContain("✅ active");
    expect(table).toContain("💳 payment pending");
    expect(table).not.toContain("@rejected-user");
    expect(table).not.toContain("@expired-user");
  });

  test("includes banner preview links", () => {
    const bids = [makeBid({ banner_url: "https://cdn.example.com/img.png" })];
    const table = generateBidTable(bids);
    expect(table).toContain("[preview](https://cdn.example.com/img.png)");
  });
});

describe("generateCurrentTopBid", () => {
  test("returns 'No active bids yet' when no bids", () => {
    expect(generateCurrentTopBid([])).toBe("No active bids yet");
  });

  test("returns 'No active bids yet' when no active bids", () => {
    const bids = [
      makeBid({ status: "unlinked_pending" }),
      makeBid({ status: "rejected", amount: 200, comment_id: 2 }),
    ];
    expect(generateCurrentTopBid(bids)).toBe("No active bids yet");
  });

  test("returns highest active bid", () => {
    const bids = [
      makeBid({ bidder: "low", amount: 50, status: "active", comment_id: 1 }),
      makeBid({ bidder: "high", amount: 200, status: "active", comment_id: 2 }),
      makeBid({ bidder: "unlinked-high", amount: 300, status: "unlinked_pending", comment_id: 3 }),
    ];
    const result = generateCurrentTopBid(bids);
    expect(result).toContain("$200");
    expect(result).toContain("@high");
    expect(result).toContain("#issuecomment-2");
  });
});

describe("generateStatsSection", () => {
  test("shows first bidding period message when no stats provided", () => {
    const section = generateStatsSection();
    expect(section).toContain("### 📊 Previous Period Stats");
    expect(section).toContain("First bidding period — no previous stats yet");
  });

  test("shows first bidding period message when undefined", () => {
    const section = generateStatsSection(undefined);
    expect(section).toContain("First bidding period");
    expect(section).not.toContain("garnered");
  });

  test("includes views, clicks, CTR, and note when stats provided", () => {
    const stats = makeStats({ views: 2000, clicks: 60, ctr: 3.0 });
    const section = generateStatsSection(stats);
    expect(section).toContain("### 📊 Previous Period Stats");
    expect(section).toContain("garnered 2000 views, 60 clicks");
    expect(section).toContain("3.0% CTR");
    expect(section).toContain("Stats based on the previous full week of sponsorship");
  });

  test("formats CTR to one decimal place", () => {
    const stats = makeStats({ views: 1000, clicks: 33, ctr: 3.333 });
    const section = generateStatsSection(stats);
    expect(section).toContain("3.3% CTR");
  });
});

describe("generatePreviousStatsSection (backward compat)", () => {
  test("delegates to generateStatsSection", () => {
    const stats = makeStats({ views: 2000, clicks: 60, ctr: 3.0 });
    const fromOld = generatePreviousStatsSection(stats);
    const fromNew = generateStatsSection(stats);
    expect(fromOld).toBe(fromNew);
  });
});

describe("generateBidIssueBody", () => {
  test("includes header with schedule", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("## 🏷️ Banner Sponsorship — monthly Bidding Period");
  });

  test("includes current top bid section", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### 🔝 Current Top Bid");
    expect(body).toContain("No bids yet");
  });

  test("includes rules from config", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### Rules");
    expect(body).toContain(`$${DEFAULT_CONFIG.bidding.minimum_bid}`);
    expect(body).toContain(`$${DEFAULT_CONFIG.bidding.increment}`);
    expect(body).toContain("png, jpg, svg");
    expect(body).toContain(`${DEFAULT_CONFIG.banner.width}x${DEFAULT_CONFIG.banner.height}px`);
    expect(body).toContain(`${DEFAULT_CONFIG.banner.max_size}KB`);
  });

  test("includes empty bid table", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### Bid Table");
    expect(body).toContain("No bids yet");
  });

  test("includes how to bid section with YAML instructions", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### How to Bid");
    expect(body).toContain("```yaml");
    expect(body).toContain("amount: 100");
    expect(body).toContain("destination_url:");
    expect(body).toContain("tagline:");
    expect(body).toContain("Attach your banner image");
  });

  test("includes deadline section", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### Deadline");
    expect(body).toContain("highest active bid wins");
  });

  test("shows first bidding period message when no previous stats", () => {
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(body).toContain("### 📊 Previous Period Stats");
    expect(body).toContain("First bidding period — no previous stats yet");
  });

  test("includes previous stats when provided", () => {
    const stats = makeStats({ views: 1200, clicks: 36, ctr: 3.0 });
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod(), stats);
    expect(body).toContain("### 📊 Previous Period Stats");
    expect(body).toContain("garnered 1200 views, 36 clicks");
    expect(body).toContain("Stats based on the previous full week of sponsorship");
  });

  test("shows top bid when period has active bids", () => {
    const bids = [makeBid({ bidder: "alice", amount: 150, status: "active", comment_id: 5001 })];
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod({ bids }));
    expect(body).toContain("$150");
    expect(body).toContain("@alice");
    expect(body).toContain("#issuecomment-5001");
  });

  test("bid table includes competing bids with status labels", () => {
    const bids = [
      makeBid({ bidder: "alice", amount: 150, status: "active", comment_id: 101 }),
      makeBid({ bidder: "bob", amount: 100, status: "unlinked_pending", comment_id: 102 }),
    ];
    const body = generateBidIssueBody(DEFAULT_CONFIG, makePeriod({ bids }));
    expect(body).toContain("@alice");
    expect(body).toContain("@bob");
    expect(body).toContain("✅ active");
    expect(body).toContain("💳 payment pending");
  });

  test("uses weekly schedule in header when config is weekly", () => {
    const config: BidMeConfig = {
      ...DEFAULT_CONFIG,
      bidding: { ...DEFAULT_CONFIG.bidding, schedule: "weekly" },
    };
    const body = generateBidIssueBody(config, makePeriod());
    expect(body).toContain("weekly Bidding Period");
  });
});

describe("generateBiddingIssueBody (backward compat)", () => {
  test("delegates to generateBidIssueBody correctly", () => {
    const period = makePeriod();
    const bids = [makeBid({ bidder: "compat", amount: 75 })];
    const stats = makeStats();

    const oldResult = generateBiddingIssueBody(period, DEFAULT_CONFIG, bids, stats);
    const newResult = generateBidIssueBody(DEFAULT_CONFIG, makePeriod({ bids }), stats);

    expect(oldResult).toBe(newResult);
  });
});

describe("updateBidIssueBody", () => {
  test("updates current top bid section", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(initial).toContain("No bids yet");

    const bids = [makeBid({ bidder: "alice", amount: 200, status: "active", comment_id: 42 })];
    const updated = updateBidIssueBody(initial, bids);

    expect(updated).toContain("$200");
    expect(updated).toContain("@alice");
    expect(updated).toContain("#issuecomment-42");
    expect(updated).toContain("### 🔝 Current Top Bid");
  });

  test("updates bid table section", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());

    const bids = [
      makeBid({ bidder: "alice", amount: 200, status: "active", comment_id: 1 }),
      makeBid({ bidder: "bob", amount: 100, status: "unlinked_pending", comment_id: 2 }),
    ];
    const updated = updateBidIssueBody(initial, bids);

    expect(updated).toContain("@alice");
    expect(updated).toContain("@bob");
    expect(updated).toContain("$200");
    expect(updated).toContain("$100");
    expect(updated).toContain("### Bid Table");
  });

  test("preserves other sections unchanged", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    const bids = [makeBid()];
    const updated = updateBidIssueBody(initial, bids);

    expect(updated).toContain("### Rules");
    expect(updated).toContain("### How to Bid");
    expect(updated).toContain("### Deadline");
    expect(updated).toContain("## 🏷️ Banner Sponsorship");
  });

  test("updates first bidding period placeholder with actual stats", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());
    expect(initial).toContain("First bidding period");

    const stats = makeStats({ views: 500, clicks: 25, ctr: 5.0 });
    const updated = updateBidIssueBody(initial, [], stats);

    expect(updated).toContain("### 📊 Previous Period Stats");
    expect(updated).toContain("garnered 500 views, 25 clicks");
    expect(updated).toContain("### Rules");
    expect(updated).not.toContain("First bidding period");
  });

  test("updates existing previous stats section with new data", () => {
    const stats1 = makeStats({ views: 500, clicks: 25, ctr: 5.0 });
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod(), stats1);
    expect(initial).toContain("500 views");

    const stats2 = makeStats({ views: 1000, clicks: 50, ctr: 5.0 });
    const updated = updateBidIssueBody(initial, [], stats2);

    expect(updated).toContain("1000 views");
    expect(updated).toContain("50 clicks");
    expect(updated).not.toContain("500 views");
  });

  test("repeated updates do not accumulate extra newlines", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());

    const bids1 = [makeBid({ amount: 100, comment_id: 1 })];
    const update1 = updateBidIssueBody(initial, bids1);

    const bids2 = [
      makeBid({ amount: 100, comment_id: 1 }),
      makeBid({ bidder: "bidder2", amount: 200, comment_id: 2 }),
    ];
    const update2 = updateBidIssueBody(update1, bids2);

    expect(update2).not.toMatch(/\n{4,}/);
  });

  test("correctly shows highest active bid when unlinked bids are higher", () => {
    const initial = generateBidIssueBody(DEFAULT_CONFIG, makePeriod());

    const bids = [
      makeBid({ bidder: "active-user", amount: 100, status: "active", comment_id: 1 }),
      makeBid({ bidder: "unlinked", amount: 500, status: "unlinked_pending", comment_id: 2 }),
    ];
    const updated = updateBidIssueBody(initial, bids);

    const topBidMatch = updated.match(/### 🔝 Current Top Bid\n\n([\s\S]*?)\n\n### /);
    expect(topBidMatch).not.toBeNull();
    expect(topBidMatch![1]).toContain("$100");
    expect(topBidMatch![1]).toContain("@active-user");
    expect(topBidMatch![1]).not.toContain("$500");
  });
});

describe("generateWinnerAnnouncement", () => {
  test("includes winner details", () => {
    const bid = makeBid({ bidder: "winner", amount: 250 });
    const period = makePeriod();
    const announcement = generateWinnerAnnouncement(bid, period);

    expect(announcement).toContain("@winner");
    expect(announcement).toContain("$250");
    expect(announcement).toContain("🏆");
    expect(announcement).toContain("2026-02-01 to 2026-02-08");
  });

  test("includes payment status message when provided", () => {
    const bid = makeBid();
    const period = makePeriod();
    const paymentStatus = "✅ Payment processed successfully";
    const announcement = generateWinnerAnnouncement(bid, period, paymentStatus);

    expect(announcement).toContain("Payment");
    expect(announcement).toContain("✅ Payment processed successfully");
  });

  test("shows manual payment message when no checkout URL", () => {
    const bid = makeBid();
    const period = makePeriod();
    const announcement = generateWinnerAnnouncement(bid, period);

    expect(announcement).toContain("Payment processing is not configured");
  });
});

describe("generateNoBidsMessage", () => {
  test("includes period dates", () => {
    const period = makePeriod();
    const msg = generateNoBidsMessage(period);

    expect(msg).toContain("2026-02-01");
    expect(msg).toContain("2026-02-08");
    expect(msg).toContain("No Winner");
    expect(msg).toContain("no active bids");
  });
});
