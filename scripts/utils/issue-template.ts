import type { PeriodData, BidRecord } from "../bid-opener.ts";
import type { BidMeConfig } from "./config.ts";

export function generateBidTable(bids: BidRecord[]): string {
  if (bids.length === 0) {
    return `| Rank | Bidder | Amount | Status | Banner Preview |
|------|--------|--------|--------|----------------|
| — | No bids yet | — | — | — |`;
  }

  const sorted = [...bids].sort((a, b) => b.amount - a.amount);
  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    approved: "✅",
    rejected: "❌",
  };

  const rows = sorted
    .map((bid, i) => {
      const emoji = statusEmoji[bid.status] ?? "⏳";
      const preview = `[preview](${bid.banner_url})`;
      return `| ${i + 1} | @${bid.bidder} | $${bid.amount} | ${emoji} ${bid.status} | ${preview} |`;
    })
    .join("\n");

  return `| Rank | Bidder | Amount | Status | Banner Preview |
|------|--------|--------|--------|----------------|
${rows}`;
}

export function generateBiddingIssueBody(
  period: PeriodData,
  config: BidMeConfig,
  bids: BidRecord[],
): string {
  const formats = config.banner.format.split(",").map((f) => f.trim());
  const endDate = new Date(period.end_date);
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

  return `## 🎯 BidMe Banner Bidding

### Rules
- **Minimum bid:** $${config.bidding.minimum_bid}
- **Bid increment:** $${config.bidding.increment}
- **Accepted banner formats:** ${formats.join(", ")}
- **Banner dimensions:** ${config.banner.width}x${config.banner.height}px
- **Max file size:** ${config.banner.max_size}KB

### Current Status

${table}

### How to Bid

Post a comment with the following format:

\`\`\`yaml
amount: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: you@example.com
\`\`\`

### Deadline

**${deadline}** — ${countdown}

Bids must be submitted before the deadline. The highest approved bid wins the banner slot.

---
*Powered by [BidMe](https://github.com/danarrib/bidme)*`;
}

export function generateWinnerAnnouncement(
  bid: BidRecord,
  period: PeriodData,
  checkoutUrl?: string,
): string {
  const paymentSection = checkoutUrl
    ? `\n### 💳 Payment\n\nPlease complete your payment to activate the banner:\n\n**[Complete Payment →](${checkoutUrl})**\n`
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
| Destination | ${bid.destination_url} |
${paymentSection}
The README banner has been updated. Thank you to all bidders!

---
*Powered by [BidMe](https://github.com/danarrib/bidme)*`;
}

export function generateNoBidsMessage(period: PeriodData): string {
  return `## 📭 Bidding Period Closed — No Winner

The bidding period (**${period.start_date.split("T")[0]}** to **${period.end_date.split("T")[0]}**) has ended with no approved bids.

The banner slot remains unchanged. A new bidding period will open on the next scheduled cycle.

---
*Powered by [BidMe](https://github.com/danarrib/bidme)*`;
}
