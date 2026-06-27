import { acceptedBanner, decorateBidComment, expiredBanner } from "../lib/comment-format.ts";
import { loadConfig } from "../lib/config.ts";
import { logError } from "../lib/error-handler.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { rankOf, updateBidIssueBody } from "../lib/issue-template.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";
import { readAnalytics, readCurrentPeriod, writeCurrentPeriod } from "../lib/variable-store.ts";

export interface CheckGraceOptions {
  target?: string;
}

async function editComment(
  api: GitHubAPI,
  commentId: number,
  statusBlock: string,
  collapseOriginal: boolean,
): Promise<void> {
  try {
    const comment = await api.getComment(commentId);
    const decorated = decorateBidComment(comment.body, statusBlock, { collapseOriginal });
    await api.updateComment(commentId, decorated);
  } catch (err) {
    console.warn(`⚠ Failed to update comment ${commentId}`);
    logError(err, "check-grace:editComment");
  }
}

export async function runCheckGrace(
  options: CheckGraceOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BIDME: Checking Payment Grace Window ===\n");

  const config = await loadConfig(target);
  const graceHours = config.payment.unlinked_grace_hours;

  const periodData = await readCurrentPeriod();
  if (!periodData || periodData.status !== "open") {
    const msg = "No open bidding period — nothing to check";
    console.log(`⚠ ${msg}`);
    return { success: true, message: msg };
  }

  const pending = periodData.bids.filter((b) => b.status === "unlinked_pending");
  if (pending.length === 0) {
    const msg = "No unlinked bids awaiting payment";
    console.log(`✓ ${msg}`);
    return { success: true, message: msg };
  }
  console.log(`  Unlinked bids: ${pending.length}`);

  const stripe = new StripeAPI();
  if (!stripe.isConfigured) {
    const msg = "Stripe not configured — cannot verify payment methods";
    console.log(`⚠ ${msg}`);
    return { success: false, message: msg };
  }

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;
  const api = owner && repo ? new GitHubAPI(owner, repo) : null;

  const now = Date.now();
  const graceMs = graceHours * 60 * 60 * 1000;
  let activated = 0;
  let expired = 0;

  for (const bid of pending) {
    let linked = false;
    try {
      const customers = await stripe.searchCustomersByMetadata(bid.bidder);
      const customer = customers[0];
      if (customer) {
        const methods = await stripe.listPaymentMethods(customer.id);
        linked = methods.length > 0;
      }
    } catch (err) {
      console.warn(`⚠ Stripe lookup failed for @${bid.bidder}`);
      logError(err, "check-grace:stripeLookup");
      continue;
    }

    if (linked) {
      bid.status = "active";
      activated++;
      console.log(`✓ Activated bid from @${bid.bidder} ($${bid.amount})`);
    } else if (now - new Date(bid.timestamp).getTime() > graceMs) {
      bid.status = "expired";
      expired++;
      console.log(`⌛ Expired bid from @${bid.bidder} (grace elapsed)`);
    }
  }

  if (activated === 0 && expired === 0) {
    const msg = "No bids changed — all still within grace window";
    console.log(`✓ ${msg}`);
    return { success: true, message: msg };
  }

  await writeCurrentPeriod(periodData);
  console.log("✓ Period state updated");

  if (api) {
    for (const bid of pending) {
      if (bid.status === "active") {
        await editComment(
          api,
          bid.comment_id,
          acceptedBanner(bid.amount, rankOf(periodData.bids, bid.comment_id)),
          false,
        );
      } else if (bid.status === "expired") {
        await editComment(api, bid.comment_id, expiredBanner(graceHours), true);
      }
    }

    try {
      const analytics = await readAnalytics();
      const previousStats =
        analytics.periods.length > 0 ? analytics.periods[analytics.periods.length - 1] : undefined;
      const issue = await api.getIssue(periodData.issue_number);
      const updatedBody = updateBidIssueBody(issue.body, periodData.bids, previousStats);
      await api.updateIssueBody(periodData.issue_number, updatedBody);
      console.log("✓ Issue leaderboard refreshed");
    } catch (err) {
      console.warn("⚠ Failed to refresh issue leaderboard");
      logError(err, "check-grace:updateIssueBody");
    }
  }

  const msg = `Grace check complete — ${activated} activated, ${expired} expired`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
