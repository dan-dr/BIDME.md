import {
  acceptedBanner,
  decorateBidComment,
  paymentRequiredBanner,
  rejectedBanner,
} from "../lib/comment-format.ts";
import { loadConfig, resolvePaymentUrls } from "../lib/config.ts";
import { enforceContent } from "../lib/content-enforcer.ts";
import { isRateLimited, logError, withRetry } from "../lib/error-handler.ts";
import { GitHubAPI, GitHubAPIError } from "../lib/github-api.ts";
import { rankOf, updateBidIssueBody } from "../lib/issue-template.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";
import type { BidRecord, PeriodData } from "../lib/types.ts";
import { parseBidComment, validateBid } from "../lib/validation.ts";
import { readAnalytics, readCurrentPeriod, writeCurrentPeriod } from "../lib/variable-store.ts";

export interface ProcessBidOptions {
  target?: string;
}

async function editBidComment(
  api: GitHubAPI,
  commentId: number,
  currentBody: string,
  statusBlock: string,
  options: { collapseOriginal?: boolean } = {},
): Promise<void> {
  try {
    const decorated = decorateBidComment(currentBody, statusBlock, options);
    await api.updateComment(commentId, decorated);
  } catch (err) {
    console.warn("⚠ Failed to update bid comment — bid state is still recorded");
    logError(err, "process-bid:editComment");
  }
}

async function refreshIssueBody(
  api: GitHubAPI,
  issueNumber: number,
  bids: BidRecord[],
): Promise<void> {
  try {
    const analytics = await readAnalytics();
    const previousStats =
      analytics.periods.length > 0 ? analytics.periods[analytics.periods.length - 1] : undefined;
    const issue = await api.getIssue(issueNumber);
    const updatedBody = updateBidIssueBody(issue.body, bids, previousStats);
    await api.updateIssueBody(issueNumber, updatedBody);
    console.log("✓ Issue body updated with live bid info");
  } catch (err) {
    console.warn("⚠ Failed to update issue body — bid is still recorded");
    logError(err, "process-bid:updateIssueBody");
  }
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
  const api = owner && repo ? new GitHubAPI(owner, repo) : null;

  let commentBody: string;
  let bidder: string;

  if (!api) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    commentBody = "";
    bidder = "local-user";
  } else {
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

  // 1. Parse bid format
  const parsed = parseBidComment(commentBody);
  if (!parsed) {
    const reason =
      "Could not parse bid. Attach a banner image and include a YAML block with `amount`, `destination_url`, and `tagline`.";
    console.log("✗ Failed to parse bid comment");
    if (api)
      await editBidComment(api, commentId, commentBody, rejectedBanner([reason]), {
        collapseOriginal: true,
      });
    return { success: false, message: reason };
  }

  console.log(`  Parsed bid: $${parsed.amount} from @${bidder}`);

  // 2. Basic validation (amount, URLs)
  const validation = validateBid(parsed, config);
  if (!validation.valid) {
    const reasons = validation.errors.map((e) => e.message);
    console.log(`✗ Bid validation failed:\n${reasons.map((r) => `- ${r}`).join("\n")}`);
    if (api)
      await editBidComment(api, commentId, commentBody, rejectedBanner(reasons), {
        collapseOriginal: true,
      });
    return { success: false, message: `Bid validation failed: ${reasons.join("; ")}` };
  }

  // 3. Check highest bid (fail fast before payment/content)
  const freshPeriodData: PeriodData = (await readCurrentPeriod()) ?? periodData;
  const competing = freshPeriodData.bids.filter(
    (b) => b.status === "active" || b.status === "unlinked_pending",
  );
  const currentHighest = competing.reduce((max, b) => Math.max(max, b.amount), 0);

  if (currentHighest > 0 && parsed.amount <= currentHighest) {
    const reason = `Bid of $${parsed.amount} must be higher than the current highest bid of $${currentHighest}.`;
    console.log(`✗ ${reason}`);
    if (api)
      await editBidComment(api, commentId, commentBody, rejectedBanner([reason]), {
        collapseOriginal: true,
      });
    return { success: false, message: reason };
  }

  // 4. Content enforcement (banner image + prohibited keywords)
  const enforcement = await enforceContent(parsed, config);
  if (!enforcement.passed) {
    console.log(
      `✗ Content enforcement failed:\n${enforcement.errors.map((e) => `- ${e}`).join("\n")}`,
    );
    if (api)
      await editBidComment(api, commentId, commentBody, rejectedBanner(enforcement.errors), {
        collapseOriginal: true,
      });
    return {
      success: false,
      message: `Content enforcement failed: ${enforcement.errors.join("; ")}`,
    };
  }
  console.log("✓ Content enforcement passed");

  // 5. Payment check — a bid is active the moment a Stripe payment method is linked
  let paymentLinked = false;
  let checkoutUrl = "";
  const stripe = new StripeAPI();
  if (stripe.isConfigured) {
    try {
      const existing = await stripe.searchCustomersByMetadata(bidder);
      const customer = existing[0];
      if (customer) {
        const methods = await stripe.listPaymentMethods(customer.id);
        paymentLinked = methods.length > 0;
      }

      if (!paymentLinked && api) {
        const paymentUrls = resolvePaymentUrls(config, owner, repo);
        const customerId =
          customer?.id ??
          (await stripe.createCustomer(`${bidder}@github.bidme`, { github_username: bidder })).id;
        const session = await stripe.createCheckoutSession(
          customerId,
          paymentUrls.success,
          paymentUrls.fail,
          bidder,
        );
        checkoutUrl = session.url;
        console.log(`✓ Generated Stripe Checkout session for @${bidder}`);
      }
    } catch (err) {
      console.warn(
        `⚠ Stripe payment check failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  const status: BidRecord["status"] = paymentLinked ? "active" : "unlinked_pending";
  const bidRecord: BidRecord = {
    bidder,
    amount: parsed.amount,
    banner_url: parsed.banner_url,
    destination_url: parsed.destination_url,
    tagline: parsed.tagline,
    contact: parsed.contact,
    status,
    comment_id: commentId,
    timestamp: new Date().toISOString(),
  };

  freshPeriodData.bids.push(bidRecord);
  await writeCurrentPeriod(freshPeriodData);
  console.log(`✓ Bid recorded (status: ${status})`);

  if (api) {
    await refreshIssueBody(api, issueNumber, freshPeriodData.bids);

    if (paymentLinked) {
      const rank = rankOf(freshPeriodData.bids, commentId);
      await editBidComment(api, commentId, commentBody, acceptedBanner(parsed.amount, rank));
    } else {
      await editBidComment(
        api,
        commentId,
        commentBody,
        paymentRequiredBanner(parsed.amount, checkoutUrl, config.payment.unlinked_grace_hours),
      );
    }
  }

  const msg = paymentLinked
    ? `Bid of $${parsed.amount} by @${bidder} is active`
    : `Bid of $${parsed.amount} by @${bidder} paused — payment not linked`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
