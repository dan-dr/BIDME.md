import type { BidMeConfig } from "./config.ts";
import type { BidRecord, PeriodAnalytics, PeriodData } from "./types.ts";

const STATUS_LABELS: Record<BidRecord["status"], string> = {
  active: "✅ active",
  unlinked_pending: "💳 payment pending",
  rejected: "❌ rejected",
  expired: "⌛ expired",
};

const TABLE_HEADER = `| Rank | Bidder | Amount | Status | Tagline | Banner |
|------|--------|--------|--------|---------|--------|`;

/** Bids that compete for the slot, highest first. */
export function competingBids(bids: BidRecord[]): BidRecord[] {
  return bids
    .filter((b) => b.status === "active" || b.status === "unlinked_pending")
    .sort((a, b) => b.amount - a.amount);
}

/** 1-based rank of a bid (by its comment id) among competing bids. */
export function rankOf(bids: BidRecord[], commentId: number): number {
  const index = competingBids(bids).findIndex((b) => b.comment_id === commentId);
  return index === -1 ? competingBids(bids).length + 1 : index + 1;
}

export function generateBidTable(bids: BidRecord[]): string {
  const ranked = competingBids(bids);
  if (ranked.length === 0) {
    return `${TABLE_HEADER}
| — | No bids yet | — | — | — | — |`;
  }

  const rows = ranked
    .map((bid, i) => {
      const preview = `[preview](${bid.banner_url})`;
      return `| ${i + 1} | @${bid.bidder} | $${bid.amount} | ${STATUS_LABELS[bid.status]} | ${bid.tagline ?? ""} | ${preview} |`;
    })
    .join("\n");

  return `${TABLE_HEADER}
${rows}`;
}

export function generateCurrentTopBid(bids: BidRecord[]): string {
  const active = bids.filter((b) => b.status === "active").sort((a, b) => b.amount - a.amount);

  if (active.length === 0) {
    return "No active bids yet";
  }

  const top = active[0]!;
  return `**$${top.amount}** by @${top.bidder} — [view bid](#issuecomment-${top.comment_id})`;
}

export function generateStatsSection(stats?: PeriodAnalytics): string {
  if (!stats) {
    return `### 📊 Previous Period Stats

📊 *First bidding period — no previous stats yet*`;
  }

  return `### 📊 Previous Period Stats

📊 **Previous BIDME sponsorship garnered ${stats.views} views, ${stats.clicks} clicks** (${stats.ctr.toFixed(1)}% CTR)

Stats based on the previous full week of sponsorship`;
}

export function generateLiveAnalyticsSection(
  avgDailyViews7d = 0,
  periodClicks = 0,
  ctr = 0,
  lastUpdated = new Date().toISOString(),
): string {
  return `<!-- bidme-analytics-start -->
### 📊 Live Analytics

| Metric | Value |
|--------|-------|
| Avg daily views (7d) | ${Math.round(avgDailyViews7d).toLocaleString("en-US")} |
| Banner clicks (this period) | ${periodClicks.toLocaleString("en-US")} |
| CTR | ${ctr.toFixed(2)}% |
| Last updated | ${lastUpdated.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")} |
<!-- bidme-analytics-end -->`;
}

export function generatePreviousStatsSection(stats: PeriodAnalytics): string {
  return generateStatsSection(stats);
}

export function generateBidIssueBody(
  config: BidMeConfig,
  periodData: PeriodData,
  previousStats?: PeriodAnalytics,
): string {
  const bids = periodData.bids;
  const formats = config.banner.formats;
  const endDate = new Date(periodData.end_date);
  const deadline = endDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const now = new Date();
  const msLeft = endDate.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const countdown =
    daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining` : "Bidding has ended";

  const table = generateBidTable(bids);
  const topBid = generateCurrentTopBid(bids);

  const sections: string[] = [];

  sections.push(`## 🏷️ Banner Sponsorship — ${config.bidding.schedule} Bidding Period`);

  sections.push(`### 🔝 Current Top Bid

${topBid}`);

  sections.push(generateStatsSection(previousStats));

  sections.push(generateLiveAnalyticsSection());

  sections.push(`### Rules
- **Minimum bid:** $${config.bidding.minimum_bid}
- **Bid increment:** $${config.bidding.increment}
- **Accepted banner formats:** ${formats.join(", ")}
- **Banner dimensions:** ${config.banner.width}x${config.banner.height}px
- **Max file size:** ${config.banner.max_size}KB`);

  sections.push(`### Bid Table

${table}`);

  sections.push(`### How to Bid

Attach your banner image to a comment and include:

\`\`\`yaml
---
bid:
  amount: 100
  destination_url: "https://example.com"
  tagline: "Build faster with our tools"
---
\`\`\``);

  sections.push(`### Deadline

**${deadline}** — ${countdown}

Bids must be submitted before the deadline. The highest active bid wins the banner slot.

---
*Powered by [BIDME](https://github.com/danarrib/bidme)*`);

  return sections.join("\n\n");
}

export function generateBiddingIssueBody(
  period: PeriodData,
  config: BidMeConfig,
  bids: BidRecord[],
  previousStats?: PeriodAnalytics,
): string {
  const periodWithBids: PeriodData = { ...period, bids };
  return generateBidIssueBody(config, periodWithBids, previousStats);
}

export function generateWinnerAnnouncement(
  bid: BidRecord,
  period: PeriodData,
  paymentStatus?: string,
): string {
  const paymentSection = paymentStatus
    ? `\n### 💳 Payment\n\n${paymentStatus}\n`
    : `\n### 💳 Payment\n\n> Payment processing is not configured. Please contact the repository owner to arrange payment.\n`;

  return `## 🏆 Bidding Period Closed — Winner Announced!

Congratulations **@${bid.bidder}**! 🎉

Your bid of **$${bid.amount}** has won the banner slot for this period.

| Detail | Value |
|--------|-------|
| Winner | @${bid.bidder} |
| Amount | $${bid.amount} |
| Period | ${period.start_date.split("T")[0]} to ${period.end_date.split("T")[0]} |
| Banner | [View](${bid.banner_url}) |
| Tagline | ${bid.tagline ?? ""} |
| Destination | ${bid.destination_url} |
${paymentSection}
The README banner has been updated. Thank you to all bidders!

---
*Powered by [BIDME](https://github.com/danarrib/bidme)*`;
}

export function updateBidIssueBody(
  existingBody: string,
  bids: BidRecord[],
  previousStats?: PeriodAnalytics,
): string {
  let body = existingBody;

  const topBid = generateCurrentTopBid(bids);
  body = body.replace(
    /### 🔝 Current Top Bid\n\n[\s\S]*?(?=\n\n### )/,
    `### 🔝 Current Top Bid\n\n${topBid}`,
  );

  const table = generateBidTable(bids);
  body = body.replace(/### Bid Table\n\n[\s\S]*?(?=\n\n### )/, `### Bid Table\n\n${table}`);

  if (previousStats) {
    const statsSection = generateStatsSection(previousStats);
    body = body.replace(/### 📊 Previous Period Stats[\s\S]*?(?=\n\n### )/, statsSection);
  }

  return body;
}

export function generateNoBidsMessage(period: PeriodData): string {
  return `## 📭 Bidding Period Closed — No Winner

The bidding period (**${period.start_date.split("T")[0]}** to **${period.end_date.split("T")[0]}**) has ended with no active bids.

The banner slot remains unchanged. A new bidding period will open on the next scheduled cycle.

---
*Powered by [BIDME](https://github.com/danarrib/bidme)*`;
}
