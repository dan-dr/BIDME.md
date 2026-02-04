import { loadConfig } from "./utils/config";
import { GitHubAPI } from "./utils/github-api";
import { generateBidTable } from "./utils/issue-template";
import { parseBidComment, validateBid } from "./utils/validation";
import type { PeriodData, BidRecord } from "./bid-opener";
import { resolve } from "path";

function updateIssueBodyWithBids(
  existingBody: string,
  bids: BidRecord[],
): string {
  const tableSection = generateBidTable(bids);
  return existingBody.replace(
    /\| Rank \| Bidder \| Amount \| Status \| Banner Preview \|[\s\S]*?(?=\n### |\n---|\n\*Powered)/,
    tableSection + "\n",
  );
}

export async function processBid(
  issueNumber: number,
  commentId: number,
  configPath?: string,
): Promise<{ success: boolean; message: string }> {
  console.log("=== BidMe: Processing Bid ===\n");
  console.log(`  Issue: #${issueNumber}`);
  console.log(`  Comment: ${commentId}`);

  const config = await loadConfig(configPath);
  console.log("✓ Config loaded");

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

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const repo = process.env["GITHUB_REPOSITORY"]?.split("/")[1] ?? "";

  let commentBody: string;
  let bidder: string;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    commentBody = "";
    bidder = "local-user";
  } else {
    const api = new GitHubAPI(owner, repo);
    const comment = await api.getComment(commentId);
    commentBody = comment.body;
    bidder = comment.user.login;
    console.log(`✓ Fetched comment from @${bidder}`);
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
      await api.addComment(
        issueNumber,
        `❌ **Bid rejected**\n\n${errorList}`,
      );
    }

    return { success: false, message: msg };
  }

  const currentHighest = periodData.bids
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

  const bidRecord: BidRecord = {
    bidder,
    amount: parsed.amount,
    banner_url: parsed.banner_url,
    destination_url: parsed.destination_url,
    contact: parsed.contact,
    status: "pending",
    comment_id: commentId,
    timestamp: new Date().toISOString(),
  };

  periodData.bids.push(bidRecord);
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
  console.log("✓ Bid recorded in period data");

  if (owner && repo) {
    const api = new GitHubAPI(owner, repo);

    const issue = await api.getIssue(issueNumber);
    const updatedBody = updateIssueBodyWithBids(issue.body, periodData.bids);
    await api.updateIssueBody(issueNumber, updatedBody);

    await api.addComment(
      issueNumber,
      `✅ **Bid accepted!**\n\n@${bidder} has placed a bid of **$${parsed.amount}**.\n\nStatus: ⏳ Pending owner approval.`,
    );
    console.log("✓ Issue updated and confirmation posted");
  }

  const msg = `Bid of $${parsed.amount} by @${bidder} accepted (pending approval)`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}

export { generateBidTable, updateIssueBodyWithBids };

if (import.meta.main) {
  const args = process.argv.slice(2);
  const issueNumber = parseInt(args[0] ?? "", 10);
  const commentId = parseInt(args[1] ?? "", 10);

  if (isNaN(issueNumber) || isNaN(commentId)) {
    console.error("Usage: bun run scripts/bid-processor.ts <issue_number> <comment_id>");
    process.exit(1);
  }

  processBid(issueNumber, commentId).catch((err) => {
    console.error("Error processing bid:", err);
    process.exit(1);
  });
}
