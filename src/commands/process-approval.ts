import { resolve } from "path";
import { loadConfig } from "../lib/config.ts";
import { GitHubAPI, GitHubAPIError } from "../lib/github-api.ts";
import { updateBidIssueBody } from "../lib/issue-template.ts";
import { loadAnalytics } from "../lib/analytics-store.ts";
import { logError, withRetry, isRateLimited } from "../lib/error-handler.ts";
import type { PeriodData, BidRecord } from "../lib/types.ts";

export interface ProcessApprovalOptions {
  target?: string;
}

export async function runProcessApproval(
  issueNumber: number,
  commentId: number,
  options: ProcessApprovalOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Processing Bid Approval ===\n");
  console.log(`  Issue: #${issueNumber}`);
  console.log(`  Comment: ${commentId}`);

  const config = await loadConfig(target);
  console.log("✓ Config loaded");
  console.log(`  Approval mode: ${config.approval.mode}`);

  if (config.approval.mode === "auto") {
    const msg = "Approval mode is 'auto' — bids are approved automatically, no manual approval needed";
    console.log(`⚠ ${msg}`);
    return { success: true, message: msg };
  }

  const dataPath = resolve(target, ".bidme/data/current-period.json");
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

  const bidIndex = periodData.bids.findIndex((b) => b.comment_id === commentId);
  if (bidIndex === -1) {
    const msg = `No bid found for comment ${commentId}`;
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  const bid = periodData.bids[bidIndex]!;
  if (bid.status !== "pending") {
    const msg = `Bid by @${bid.bidder} is already ${bid.status}`;
    console.log(`⚠ ${msg}`);
    return { success: true, message: msg };
  }

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    console.log("  Cannot check reactions without GitHub API");
    return { success: false, message: "GitHub environment not configured" };
  }

  const api = new GitHubAPI(owner, repo);

  let reactions: { content: string; user: { login: string } }[];
  try {
    reactions = await withRetry(() => api.getReactions(commentId), 2, {
      onRetry: (attempt, error) => {
        if (isRateLimited(error)) {
          console.warn(`⚠ Rate limited fetching reactions (attempt ${attempt}), retrying...`);
        } else {
          console.warn(`⚠ Failed to fetch reactions (attempt ${attempt}), retrying...`);
        }
      },
    });
    console.log(`✓ Fetched ${reactions.length} reaction(s) on comment`);
  } catch (err) {
    if (err instanceof GitHubAPIError && err.status === 404) {
      const msg = "Comment not found — it may have been deleted";
      console.log(`✗ ${msg}`);
      logError(err, "process-approval:getReactions");
      return { success: false, message: msg };
    }
    throw err;
  }

  const allowedReactions = config.approval.allowed_reactions;
  const ownerReaction = reactions.find(
    (r) => r.user.login === owner && allowedReactions.includes(r.content),
  );

  let newStatus: BidRecord["status"];
  if (ownerReaction) {
    newStatus = "approved";
    console.log(`✓ Owner @${owner} reacted with "${ownerReaction.content}" — approving bid`);
  } else {
    newStatus = "rejected";
    console.log(`✗ No matching owner reaction found — rejecting bid`);
  }

  periodData.bids[bidIndex] = { ...bid, status: newStatus };
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Bid status updated to "${newStatus}"`);

  try {
    const analyticsPath = resolve(target, ".bidme/data/analytics.json");
    const analytics = await loadAnalytics(analyticsPath);
    const previousStats = analytics.periods.length > 0
      ? analytics.periods[analytics.periods.length - 1]
      : undefined;

    const issue = await api.getIssue(issueNumber);
    const updatedBody = updateBidIssueBody(issue.body, periodData.bids, previousStats);
    await api.updateIssueBody(issueNumber, updatedBody);
    console.log("✓ Issue body updated with current top bid");
  } catch (err) {
    console.warn("⚠ Failed to update issue body — approval is still recorded");
    logError(err, "process-approval:updateIssueBody");
  }

  try {
    const statusLabel = newStatus === "approved" ? "✅ Approved" : "❌ Rejected";
    const commentText = `${statusLabel} — Bid by @${bid.bidder} for **$${bid.amount}** has been ${newStatus}.`;
    await api.addComment(issueNumber, commentText);
    console.log("✓ Confirmation comment posted");
  } catch (err) {
    console.warn("⚠ Failed to post confirmation comment — approval is still recorded");
    logError(err, "process-approval:addComment");
  }

  const msg = `Bid by @${bid.bidder} for $${bid.amount} has been ${newStatus}`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
