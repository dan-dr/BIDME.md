import { loadConfig, resolvePaymentUrls } from "../lib/config.ts";
import { GitHubAPI, GitHubAPIError } from "../lib/github-api.ts";
import { parseBidComment, validateBid } from "../lib/validation.ts";
import { updateBidIssueBody } from "../lib/issue-template.ts";
import { logError, withRetry, isRateLimited } from "../lib/error-handler.ts";
import { enforceContent } from "../lib/content-enforcer.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";
import { readAnalytics, readCurrentPeriod, writeCurrentPeriod } from "../lib/variable-store.ts";
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
  console.log("=== BIDME: Processing Bid ===\n");
  console.log(`  Issue: #${issueNumber}`);
  console.log(`  Comment: ${commentId}`);

  const config = await loadConfig(target);
  console.log("✓ Config loaded");
  console.log(`  Approval mode: ${config.approval.mode}`);

  const periodData = await readCurrentPeriod();
  if (!periodData) {
    const msg = "No active bidding period found";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

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

  if (commentBody.trim().toLowerCase().startsWith("/approve")) {
    return processApprovalCommand({
      issueNumber,
      commentBody,
      actor: bidder,
      owner,
      repo,
      periodData,
    });
  }

  // 1. Parse bid format
  const parsed = parseBidComment(commentBody);
  if (!parsed) {
    const msg =
      "Could not parse bid. Attach a banner image and use:\n\n```yaml\n---\nbid:\n  amount: 100\n  destination_url: \"https://example.com\"\n  tagline: \"Build faster\"\n---\n```";
    console.log("✗ Failed to parse bid comment");

    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(issueNumber, `❌ **Invalid bid format**\n\n${msg}`);
    }

    return { success: false, message: msg };
  }

  console.log(`  Parsed bid: $${parsed.amount} from @${bidder}`);

  // 2. Basic validation (amount, URLs, contact format)
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

  // 3. Check highest bid (before payment/content to fail fast)
  const freshPeriodData: PeriodData = (await readCurrentPeriod()) ?? periodData;
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

  // 4. Payment check (before content enforcement which makes HTTP calls)
  let paymentLinked = false;
  let paymentLink = "";
  const stripe = new StripeAPI();
  if (stripe.isConfigured) {
    try {
      const existing = await stripe.searchCustomersByMetadata(bidder);
      const customer = existing[0];
      if (customer) {
        const methods = await stripe.listPaymentMethods(customer.id);
        paymentLinked = methods.length > 0;
      }

      if (!paymentLinked && owner && repo) {
        const paymentUrls = resolvePaymentUrls(config, owner, repo);
        const customerId = customer?.id ?? (await stripe.createCustomer(
          `${bidder}@github.bidme`,
          { github_username: bidder },
        )).id;
        const session = await stripe.createCheckoutSession(
          customerId,
          paymentUrls.success,
          paymentUrls.fail,
          bidder,
        );
        paymentLink = session.url;
        console.log(`✓ Generated Stripe Checkout session for @${bidder}`);
      }
    } catch (err) {
      console.warn(`⚠ Stripe payment check failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  if (!paymentLinked) {
    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      const body = paymentLink
        ? `⚠️ @${bidder} — please [authorize your payment method](${paymentLink}) to activate your bid. You have 24 hours.`
        : `⚠️ @${bidder} — payment authorization could not be started automatically. Your bid was recorded but is paused until Stripe setup is fixed.`;
      await api.addComment(issueNumber, body);
    }

    const bidRecord: BidRecord = {
      bidder,
      amount: parsed.amount,
      banner_url: parsed.banner_url,
      destination_url: parsed.destination_url,
      tagline: parsed.tagline,
      contact: parsed.contact,
      status: "unlinked_pending",
      comment_id: commentId,
      timestamp: new Date().toISOString(),
    };

    freshPeriodData.bids.push(bidRecord);
    await writeCurrentPeriod(freshPeriodData);
    console.log("✓ Bid recorded (status: unlinked_pending)");

    const msg = `Bid of $${parsed.amount} by @${bidder} paused — payment not linked`;
    console.log(`\n⚠ ${msg}`);
    return { success: true, message: msg };
  }

  // 5. Content enforcement (banner image check — makes HTTP calls)
  const enforcement = await enforceContent(parsed, config);
  if (!enforcement.passed) {
    const errorList = enforcement.errors.map((e) => `- ${e}`).join("\n");
    const msg = `Content enforcement failed:\n${errorList}`;
    console.log(`✗ ${msg}`);

    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(
        issueNumber,
        `❌ **Bid rejected — content requirements not met**\n\n${errorList}`,
      );
    }

    return { success: false, message: msg };
  }

  console.log("✓ Content enforcement passed");

  // 6. Accept the bid
  let bidStatus: BidRecord["status"] =
    config.approval.mode === "auto" ? "approved" : "pending";

  const bidRecord: BidRecord = {
    bidder,
    amount: parsed.amount,
    banner_url: parsed.banner_url,
    destination_url: parsed.destination_url,
    tagline: parsed.tagline,
    contact: parsed.contact,
    status: bidStatus,
    comment_id: commentId,
    timestamp: new Date().toISOString(),
  };

  freshPeriodData.bids.push(bidRecord);
  await writeCurrentPeriod(freshPeriodData);
  console.log(`✓ Bid recorded (status: ${bidStatus})`);

  if (owner && repo) {
    const api = new GitHubAPI(owner, repo);

    try {
      const analytics = await readAnalytics();
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
        commentText += `\n\n> **Repo owner:** Comment \`/approve @${bidder}\` to approve this bid.`;
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

async function processApprovalCommand(args: {
  issueNumber: number;
  commentBody: string;
  actor: string;
  owner: string;
  repo: string;
  periodData: PeriodData;
}): Promise<{ success: boolean; message: string }> {
  const { issueNumber, commentBody, actor, owner, repo, periodData } = args;

  if (owner && actor !== owner) {
    const msg = `Only the repository owner can approve bids`;
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  const match = commentBody.match(/^\/approve(?:\s+@?([A-Za-z0-9-]+))?/i);
  const requestedBidder = match?.[1];
  const approvable = periodData.bids.filter((bid) => bid.status === "pending");
  const bid = requestedBidder
    ? approvable.find((candidate) => candidate.bidder.toLowerCase() === requestedBidder.toLowerCase())
    : approvable.length === 1
      ? approvable[0]
      : undefined;

  if (!bid) {
    const hasUnlinked = requestedBidder
      ? periodData.bids.some((candidate) =>
        candidate.bidder.toLowerCase() === requestedBidder.toLowerCase() &&
        candidate.status === "unlinked_pending"
      )
      : periodData.bids.some((candidate) => candidate.status === "unlinked_pending");
    const msg = hasUnlinked
      ? "Bid cannot be approved until payment is linked"
      : "No matching pending bid to approve";
    console.log(`✗ ${msg}`);
    if (owner && repo) {
      const api = new GitHubAPI(owner, repo);
      await api.addComment(issueNumber, `❌ ${msg}`);
    }
    return { success: false, message: msg };
  }

  bid.status = "approved";
  await writeCurrentPeriod(periodData);
  console.log(`✓ Approved bid from @${bid.bidder}`);

  if (owner && repo) {
    const api = new GitHubAPI(owner, repo);
    try {
      const analytics = await readAnalytics();
      const previousStats = analytics.periods.length > 0
        ? analytics.periods[analytics.periods.length - 1]
        : undefined;
      const issue = await api.getIssue(issueNumber);
      const updatedBody = updateBidIssueBody(issue.body, periodData.bids, previousStats);
      await api.updateIssueBody(issueNumber, updatedBody);
      await api.addComment(issueNumber, `✅ Approved bid from @${bid.bidder} for **$${bid.amount}**.`);
    } catch (err) {
      console.warn("⚠ Failed to update issue after approval — approval is still recorded");
      logError(err, "process-bid:approve");
    }
  }

  const msg = `Bid by @${bid.bidder} approved`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
