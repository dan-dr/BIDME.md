import type { BidMeConfig } from "./config.ts";
import type { BidRecord, PeriodAnalytics, PeriodData } from "./types.ts";

export function generateBidTable(bids: BidRecord[]): string {
  if (bids.length === 0) {
    return `| Rank | Bidder | Amount | Status | Tagline | Banner |
|------|--------|--------|--------|---------|--------|
| — | No bids yet | — | — | — |`;
  }

  const sorted = [...bids].sort((a, b) => b.amount - a.amount);
  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    approved: "✅",
    rejected: "❌",
    unlinked_pending: "⚠️",
  };

  const rows = sorted
    .map((bid, i) => {
      const emoji = statusEmoji[bid.status] ?? "⏳";
      const preview = `[preview](${bid.banner_url})`;
      return `| ${i + 1} | @${bid.bidder} | $${bid.amount} | ${emoji} ${bid.status} | ${bid.tagline ?? ""} | ${preview} |`;
    })
    .join("\n");

  return `| Rank | Bidder | Amount | Status | Tagline | Banner |
|------|--------|--------|--------|---------|--------|
${rows}`;
}

export function generateCurrentTopBid(bids: BidRecord[]): string {
  const approved = bids.filter((b) => b.status === "approved").sort((a, b) => b.amount - a.amount);

  if (approved.length === 0) {
    return "No bids yet";
  }

  const top = approved[0]!;
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

Bids must be submitted before the deadline. The highest approved bid wins the banner slot.

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

The bidding period (**${period.start_date.split("T")[0]}** to **${period.end_date.split("T")[0]}**) has ended with no approved bids.

The banner slot remains unchanged. A new bidding period will open on the next scheduled cycle.

---
*Powered by [BIDME](https://github.com/danarrib/bidme)*`;
}
