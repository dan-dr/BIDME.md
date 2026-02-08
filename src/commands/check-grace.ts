import { resolve } from "path";
import { loadConfig } from "../lib/config.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { StripeAPI } from "../lib/stripe-integration.ts";
import { logError } from "../lib/error-handler.ts";
import {
  loadBidders,
  saveBidders,
  isPaymentLinked,
  markPaymentLinked,
  getGraceDeadline,
  resetRegistryCache,
} from "../lib/bidder-registry.ts";
import type { PeriodData, BidRecord } from "../lib/types.ts";

export interface CheckGraceOptions {
  target?: string;
}

export async function runCheckGrace(
  options: CheckGraceOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Checking Grace Periods ===\n");

  const config = await loadConfig(target);
  const graceHours = config.payment.unlinked_grace_hours;
  console.log(`  Grace period: ${graceHours} hours`);

  const dataPath = resolve(target, ".bidme/data/current-period.json");
  const periodFile = Bun.file(dataPath);
  if (!(await periodFile.exists())) {
    const msg = "No active bidding period found";
    console.log(`✗ ${msg}`);
    return { success: true, message: msg };
  }

  const periodData: PeriodData = JSON.parse(await periodFile.text());
  if (periodData.status !== "open") {
    const msg = "Bidding period is not open";
    console.log(`✗ ${msg}`);
    return { success: true, message: msg };
  }

  const unlinkPending = periodData.bids.filter(
    (b) => b.status === "unlinked_pending",
  );

  if (unlinkPending.length === 0) {
    const msg = "No unlinked_pending bids to check";
    console.log(`✓ ${msg}`);
    return { success: true, message: msg };
  }

  console.log(`  Found ${unlinkPending.length} unlinked_pending bid(s)\n`);

  await loadBidders(target);

  // Auto-link: check Stripe for customers matching unlinked bidders
  const stripe = new StripeAPI();
  if (stripe.isConfigured) {
    console.log("  Checking Stripe for newly linked payments...");
    for (const bid of unlinkPending) {
      if (isPaymentLinked(bid.bidder)) continue;
      try {
        const customers = await stripe.searchCustomersByMetadata(bid.bidder);
        if (customers.length > 0) {
          const customer = customers[0]!;
          const methods = await stripe.listPaymentMethods(customer.id);
          if (methods.length > 0) {
            markPaymentLinked(bid.bidder, customer.id, methods[0]!.id);
            console.log(`  ✓ Auto-linked @${bid.bidder} from Stripe (customer: ${customer.id})`);
          }
        }
      } catch (err) {
        console.warn(`  ⚠ Stripe lookup failed for @${bid.bidder}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  let api: GitHubAPI | null = null;
  if (owner && repo) {
    api = new GitHubAPI(owner, repo);
  }

  const now = new Date();
  let restored = 0;
  let expired = 0;

  for (const bid of unlinkPending) {
    const linked = isPaymentLinked(bid.bidder);

    if (linked) {
      bid.status = config.approval.mode === "auto" ? "approved" : "pending";
      restored++;
      console.log(`  ✓ @${bid.bidder}: payment linked → status set to "${bid.status}"`);

      if (api) {
        try {
          if (config.enforcement.strikethrough_unlinked) {
            const comment = await api.getComment(bid.comment_id);
            const body = comment.body;
            if (body.startsWith("~~") && body.endsWith("~~")) {
              await api.updateComment(bid.comment_id, body.slice(2, -2));
            }
          }
          await api.addComment(
            periodData.issue_number,
            `✅ @${bid.bidder} — Payment linked! Your bid of **$${bid.amount}** is now active.`,
          );
        } catch (err) {
          console.warn(`  ⚠ Failed to update comments for @${bid.bidder}`);
          logError(err, "check-grace:restore");
        }
      }
      continue;
    }

    const deadline = getGraceDeadline(bid.bidder, graceHours);
    if (deadline && now >= deadline) {
      bid.status = "expired";
      expired++;
      console.log(`  ✗ @${bid.bidder}: grace period expired → status set to "expired"`);

      if (api) {
        try {
          await api.addComment(
            periodData.issue_number,
            `❌ @${bid.bidder} — Your bid has been removed — grace period expired without payment linked.`,
          );
        } catch (err) {
          console.warn(`  ⚠ Failed to post expiry comment for @${bid.bidder}`);
          logError(err, "check-grace:expire");
        }
      }
      continue;
    }

    const remaining = deadline
      ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
      : "unknown";
    console.log(`  ⏳ @${bid.bidder}: still within grace period (${remaining}h remaining)`);
  }

  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
  await saveBidders(target);

  const msg = `Grace check complete: ${restored} restored, ${expired} expired, ${unlinkPending.length - restored - expired} still pending`;
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
