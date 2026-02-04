import { GitHubAPI } from "./utils/github-api";
import { generateBidTable, updateIssueBodyWithBids } from "./bid-processor";
import type { PeriodData, BidRecord } from "./bid-opener";
import { resolve } from "path";

export async function processApproval(
  issueNumber: number,
  commentId: number,
): Promise<{ success: boolean; message: string }> {
  console.log("=== BidMe: Processing Approval ===\n");
  console.log(`  Issue: #${issueNumber}`);
  console.log(`  Comment: ${commentId}`);

  const dataPath = resolve(process.cwd(), "data/current-period.json");
  const periodFile = Bun.file(dataPath);
  if (!(await periodFile.exists())) {
    const msg = "No active bidding period found";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  const periodData: PeriodData = JSON.parse(await periodFile.text());
  if (periodData.status !== "open") {
    const msg = "Bidding period is not open";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  const bid = periodData.bids.find((b) => b.comment_id === commentId);
  if (!bid) {
    const msg = `No bid found for comment ${commentId}`;
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const repo = process.env["GITHUB_REPOSITORY"]?.split("/")[1] ?? "";

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    return { success: false, message: "GitHub environment not configured" };
  }

  const api = new GitHubAPI(owner, repo);

  const reactions = await api.getReactions(commentId);
  console.log(`✓ Fetched ${reactions.length} reaction(s)`);

  const ownerReaction = reactions.find((r) => r.user.login === owner);
  if (!ownerReaction) {
    const msg = "No reaction from repository owner found";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  let newStatus: BidRecord["status"];
  let statusLabel: string;

  if (ownerReaction.content === "+1") {
    newStatus = "approved";
    statusLabel = "approved ✅";
  } else if (ownerReaction.content === "-1") {
    newStatus = "rejected";
    statusLabel = "rejected ❌";
  } else {
    const msg = `Unrecognized reaction: ${ownerReaction.content}. Use 👍 to approve or 👎 to reject.`;
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  bid.status = newStatus;
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Bid status updated to "${newStatus}"`);

  const issue = await api.getIssue(issueNumber);
  const updatedBody = updateIssueBodyWithBids(issue.body, periodData.bids);
  await api.updateIssueBody(issueNumber, updatedBody);

  const highestApproved = periodData.bids
    .filter((b) => b.status === "approved")
    .reduce((max, b) => (b.amount > max.amount ? b : max), { amount: 0 } as Partial<BidRecord>);

  let replyBody: string;
  if (newStatus === "approved") {
    replyBody = `✅ **Bid approved!**\n\n@${bid.bidder}'s bid of **$${bid.amount}** has been approved by the repository owner.`;
    if (highestApproved.amount && highestApproved.bidder) {
      replyBody += `\n\nCurrent highest approved bid: **$${highestApproved.amount}** by @${highestApproved.bidder}`;
    }
  } else {
    replyBody = `❌ **Bid rejected**\n\n@${bid.bidder}'s bid of **$${bid.amount}** has been rejected by the repository owner.`;
  }

  await api.addComment(issueNumber, replyBody);
  console.log("✓ Confirmation comment posted");

  const msg = `Bid by @${bid.bidder} for $${bid.amount} ${statusLabel}`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const issueNumber = parseInt(args[0] ?? "", 10);
  const commentId = parseInt(args[1] ?? "", 10);

  if (isNaN(issueNumber) || isNaN(commentId)) {
    console.error("Usage: bun run scripts/approval-processor.ts <issue_number> <comment_id>");
    process.exit(1);
  }

  processApproval(issueNumber, commentId).catch((err) => {
    console.error("Error processing approval:", err);
    process.exit(1);
  });
}
