import { resolve } from "path";
import { loadConfig } from "../lib/config.ts";
import { GitHubAPI, GitHubAPIError } from "../lib/github-api.ts";
import { parseBidComment, validateBid } from "../lib/validation.ts";
import { updateBidIssueBody } from "../lib/issue-template.ts";
import { loadAnalytics } from "../lib/analytics-store.ts";
import { logError, withRetry, isRateLimited } from "../lib/error-handler.ts";
import type { PeriodData, BidRecord } from "../lib/types.ts";

export interface ProcessBidOptions {
  target?: string;
}

export async function runProcessBid(
  issueNumber: number,
  commentId: number,
  options: ProcessBidOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Processing Bid ===\n");
  console.log(`  Issue: #${issueNumber}`);
  console.log(`  Comment: ${commentId}`);

  const config = await loadConfig(target);
  console.log("✓ Config loaded");
  console.log(`  Approval mode: ${config.approval.mode}`);

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

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  let commentBody: string;
  let bidder: string;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    commentBody = "";
    bidder = "local-user";
  } else {
    const api = new GitHubAPI(owner, repo);

    try {
      const comment = await withRetry(() => api.getComment(commentId), 2, {
        onRetry: (attempt, error) => {
          if (isRateLimited(error)) {
            console.warn(`⚠ Rate limited fetching comment (attempt ${attempt}), retrying...`);
          } else {
            console.warn(`⚠ Failed to fetch comment (attempt ${attempt}), retrying...`);
          }
        },
      });
      commentBody = comment.body;
      bidder = comment.user.login;
      console.log(`✓ Fetched comment from @${bidder}`);
    } catch (err) {
      if (err instanceof GitHubAPIError && err.status === 404) {
        const msg = "Comment not found — it may have been deleted";
        console.log(`✗ ${msg}`);
        logError(err, "process-bid:getComment");
        return { success: false, message: msg };
      }
      throw err;
    }
  }

  const parsed = parseBidComment(commentBody);
  if (!parsed) {
    const msg =
      "Could not parse bid. Please use the YAML format:\n\n```yaml\namount: 100\nbanner_url: https://example.com/banner.png\ndestination_url: https://example.com\ncontact: you@example.com\n```";
    console.log("✗ Failed to parse bid comment");

    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(issueNumber, `❌ **Invalid bid format**\n\n${msg}`);
    }

    return { success: false, message: msg };
  }

  console.log(`  Parsed bid: $${parsed.amount} from ${parsed.contact}`);

  const validation = validateBid(parsed, config);
  if (!validation.valid) {
    const errorList = validation.errors.map((e) => `- ${e.message}`).join("\n");
    const msg = `Bid validation failed:\n${errorList}`;
    console.log(`✗ ${msg}`);

    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(issueNumber, `❌ **Bid rejected**\n\n${errorList}`);
    }

    return { success: false, message: msg };
  }

  const freshPeriodFile = Bun.file(dataPath);
  const freshPeriodData: PeriodData = JSON.parse(await freshPeriodFile.text());

  const currentHighest = freshPeriodData.bids
    .filter((b) => b.status !== "rejected")
    .reduce((max, b) => Math.max(max, b.amount), 0);

  if (currentHighest > 0 && parsed.amount <= currentHighest) {
    const msg = `Bid of $${parsed.amount} must be higher than the current highest bid of $${currentHighest}`;
    console.log(`✗ ${msg}`);

    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(issueNumber, `❌ **Bid too low**\n\n${msg}`);
    }

    return { success: false, message: msg };
  }

  const bidStatus: BidRecord["status"] =
    config.approval.mode === "auto" ? "approved" : "pending";

  const bidRecord: BidRecord = {
    bidder,
    amount: parsed.amount,
    banner_url: parsed.banner_url,
    destination_url: parsed.destination_url,
    contact: parsed.contact,
    status: bidStatus,
    comment_id: commentId,
    timestamp: new Date().toISOString(),
  };

  freshPeriodData.bids.push(bidRecord);
  await Bun.write(dataPath, JSON.stringify(freshPeriodData, null, 2));
  console.log(`✓ Bid recorded (status: ${bidStatus})`);

  if (owner && repo) {
    const api = new GitHubAPI(owner, repo);

    try {
      const analyticsPath = resolve(target, ".bidme/data/analytics.json");
      const analytics = await loadAnalytics(analyticsPath);
      const previousStats = analytics.periods.length > 0
        ? analytics.periods[analytics.periods.length - 1]
        : undefined;

      const issue = await api.getIssue(issueNumber);
      const updatedBody = updateBidIssueBody(issue.body, freshPeriodData.bids, previousStats);
      await api.updateIssueBody(issueNumber, updatedBody);
      console.log("✓ Issue body updated with live bid info");
    } catch (err) {
      console.warn("⚠ Failed to update issue body — bid is still recorded");
      logError(err, "process-bid:updateIssueBody");
    }

    try {
      const statusLabel = bidStatus === "approved"
        ? "✅ Approved (auto-accept)"
        : "⏳ Pending owner approval";

      let commentText = `✅ **Bid accepted!**\n\n@${bidder} has placed a bid of **$${parsed.amount}**.\n\nStatus: ${statusLabel}`;

      if (bidStatus === "pending") {
        const reactions = config.approval.allowed_reactions.join(" or ");
        commentText += `\n\n> **Repo owner:** React to this comment with ${reactions} to approve this bid.`;
      }

      await api.addComment(issueNumber, commentText);
      console.log("✓ Confirmation comment posted");
    } catch (err) {
      console.warn("⚠ Failed to post confirmation comment — bid is still recorded");
      logError(err, "process-bid:addComment");
    }
  }

  const statusText = bidStatus === "approved" ? "approved" : "pending approval";
  const msg = `Bid of $${parsed.amount} by @${bidder} accepted (${statusText})`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
