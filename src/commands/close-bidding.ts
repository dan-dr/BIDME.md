import { resolve } from "path";
import { mkdir } from "fs/promises";
import { loadConfig } from "../lib/config.ts";
import type { BidMeConfig } from "../lib/config.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { generateBannerSection } from "../lib/badge-generator.ts";
import {
  generateWinnerAnnouncement,
  generateNoBidsMessage,
} from "../lib/issue-template.ts";
import { StripeAPI, StripePaymentError } from "../lib/stripe-integration.ts";
import {
  loadBidders,
  getStripeCustomerId,
  getStripePaymentMethodId,
} from "../lib/bidder-registry.ts";
import { logError } from "../lib/error-handler.ts";
import type { PeriodData, BidRecord } from "../lib/types.ts";

export interface CloseBiddingOptions {
  target?: string;
}

export function appendTrackingParams(
  destinationUrl: string,
  owner: string,
  repo: string,
): string {
  const params = `source=bidme&repo=${owner}/${repo}`;
  if (destinationUrl.includes("?")) {
    return `${destinationUrl}&${params}`;
  }
  return `${destinationUrl}?${params}`;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

async function processPayment(
  winner: BidRecord,
  periodData: PeriodData,
  targetDir: string,
): Promise<{ payment: PeriodData["payment"] | null; paymentResult: PaymentResult }> {
  const stripeApi = new StripeAPI();
  if (!stripeApi.isConfigured) {
    console.log("⚠ Stripe not configured — skipping payment processing");
    return { payment: null, paymentResult: { success: false, error: "Stripe not configured" } };
  }

  await loadBidders(targetDir);
  const customerId = getStripeCustomerId(winner.bidder);
  const paymentMethodId = getStripePaymentMethodId(winner.bidder);

  if (!customerId || !paymentMethodId) {
    console.log(`⚠ No Stripe payment method on file for @${winner.bidder}`);
    return {
      payment: {
        payment_status: "pending",
      },
      paymentResult: { success: false, error: "No payment method on file" },
    };
  }

  const amountCents = Math.round(winner.amount * 100);
  console.log(`  Processing Stripe charge: $${winner.amount} (${amountCents} cents)`);

  try {
    const paymentIntent = await stripeApi.chargeCustomer(
      customerId,
      paymentMethodId,
      amountCents,
      {
        period_id: periodData.period_id,
        bidder: winner.bidder,
        bid_amount: String(winner.amount),
      },
    );
    console.log(`✓ Stripe payment successful: ${paymentIntent.id}`);
    return {
      payment: {
        payment_status: "paid",
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntent.id,
      },
      paymentResult: { success: true, paymentIntentId: paymentIntent.id },
    };
  } catch (err) {
    if (err instanceof StripePaymentError) {
      console.log(`⚠ Stripe payment failed: ${err.message} (code: ${err.code})`);
      logError(err, "close-bidding:stripePayment");
      return {
        payment: {
          payment_status: "failed",
          stripe_customer_id: customerId,
        },
        paymentResult: { success: false, error: err.message },
      };
    }
    console.log(`⚠ Stripe error: ${err instanceof Error ? err.message : "Unknown error"}`);
    logError(err, "close-bidding:stripePayment");
    return {
      payment: {
        payment_status: "failed",
        stripe_customer_id: customerId,
      },
      paymentResult: { success: false, error: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

async function archivePeriod(periodData: PeriodData, target: string): Promise<void> {
  const archiveDir = resolve(target, ".bidme/data/archive");
  await mkdir(archiveDir, { recursive: true });

  const dateStr = periodData.start_date.split("T")[0];
  const archivePath = resolve(archiveDir, `period-${dateStr}.json`);
  await Bun.write(archivePath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Period archived to ${archivePath}`);
}

export async function runCloseBidding(
  options: CloseBiddingOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Closing Bidding Period ===\n");

  const config = await loadConfig(target);
  console.log("✓ Config loaded");

  const dataPath = resolve(target, ".bidme/data/current-period.json");
  const periodFile = Bun.file(dataPath);
  if (!(await periodFile.exists())) {
    const msg = "No active bidding period found — nothing to close";
    console.log(`⚠ ${msg}`);
    return { success: true, message: msg };
  }

  let periodData: PeriodData;
  try {
    const text = await periodFile.text();
    if (!text.trim()) {
      const msg = "Period data file is empty — nothing to close";
      console.log(`⚠ ${msg}`);
      return { success: true, message: msg };
    }
    periodData = JSON.parse(text);
  } catch (err) {
    const msg = "Period data file is corrupted — cannot close";
    console.log(`✗ ${msg}`);
    logError(err, "close-bidding:parsePeriodData");
    return { success: false, message: msg };
  }

  if (periodData.status !== "open") {
    const msg = "Bidding period is not open";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  console.log(`  Period: ${periodData.period_id}`);
  console.log(`  Total bids: ${periodData.bids.length}`);

  const approvedBids = periodData.bids.filter((b) => b.status === "approved");
  console.log(`  Approved bids: ${approvedBids.length}`);

  const winner =
    approvedBids.length > 0
      ? approvedBids.reduce((max, b) => (b.amount > max.amount ? b : max))
      : null;

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");

    if (winner) {
      const trackingUrl = appendTrackingParams(winner.destination_url, owner || "unknown", repo || "unknown");
      console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);
      console.log(`  Banner: ${winner.banner_url}`);
      console.log(`  Destination: ${trackingUrl}`);

      const { payment } = await processPayment(winner, periodData, target);
      if (payment) {
        periodData.payment = payment;
      }
    } else {
      console.log("\n✗ No approved bids — no winner");
    }

    periodData.status = "closed";
    await Bun.write(dataPath, JSON.stringify(periodData, null, 2));

    await archivePeriod(periodData, target);

    await Bun.write(dataPath, "");
    console.log("✓ Current period data cleared");

    const msg = winner
      ? `Period closed — winner: @${winner.bidder} ($${winner.amount})`
      : "Period closed — no winner";
    console.log(`\n✓ ${msg}`);
    return { success: true, message: msg };
  }

  const api = new GitHubAPI(owner, repo);

  let stripePaymentSuccess = false;
  if (winner) {
    console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);

    const { payment, paymentResult } = await processPayment(winner, periodData, target);
    if (payment) {
      periodData.payment = payment;
    }
    stripePaymentSuccess = paymentResult.success;

    const trackingUrl = appendTrackingParams(winner.destination_url, owner, repo);
    console.log(`  Tracking URL: ${trackingUrl}`);

    const readmePath = resolve(target, "README.md");
    const readmeFile = Bun.file(readmePath);
    let readmeContent: string;

    try {
      readmeContent = await readmeFile.text();
    } catch (err) {
      console.warn("⚠ Could not read README.md — skipping banner update");
      logError(err, "close-bidding:readReadme");
      readmeContent = "";
    }

    if (readmeContent) {
      const bannerMarkdown = generateBannerSection(
        winner.banner_url,
        trackingUrl,
        [],
      );

      const sponsoredLine = `\n<sub>Sponsored via [BidMe](https://github.com/danarrib/bidme)</sub>`;
      const fullBanner = `${bannerMarkdown}${sponsoredLine}`;

      const updatedReadme = readmeContent.replace(
        /<!-- BIDME:BANNER:START -->[\s\S]*?<!-- BIDME:BANNER:END -->/,
        `<!-- BIDME:BANNER:START -->\n${fullBanner}\n<!-- BIDME:BANNER:END -->`,
      );

      try {
        await Bun.write(readmePath, updatedReadme);
        console.log("✓ README updated locally with winning banner");
      } catch (err) {
        console.warn("⚠ Failed to update README — banner not updated");
        logError(err, "close-bidding:updateReadme");
      }
    }

    const paymentMessage = stripePaymentSuccess
      ? "✅ Payment processed successfully"
      : "⏳ Payment pending — winner will be contacted";
    const announcement = generateWinnerAnnouncement(winner, periodData, paymentMessage);
    try {
      await api.addComment(periodData.issue_number, announcement);
      console.log("✓ Winner announcement posted");
    } catch (err) {
      console.warn("⚠ Failed to post winner announcement");
      logError(err, "close-bidding:winnerComment");
    }
  } else {
    const noWinnerMsg = generateNoBidsMessage(periodData);
    try {
      await api.addComment(periodData.issue_number, noWinnerMsg);
      console.log("✓ No-winner comment posted");
    } catch (err) {
      console.warn("⚠ Failed to post no-winner comment");
      logError(err, "close-bidding:noWinnerComment");
    }
  }

  if (periodData.issue_node_id) {
    try {
      await api.unpinIssue(periodData.issue_node_id);
      console.log("✓ Issue unpinned");
    } catch (err) {
      console.warn("⚠ Failed to unpin issue — continuing");
      logError(err, "close-bidding:unpinIssue");
    }
  }

  try {
    await api.closeIssue(periodData.issue_number);
    console.log("✓ Issue closed");
  } catch (err) {
    console.warn("⚠ Failed to close issue");
    logError(err, "close-bidding:closeIssue");
  }

  periodData.status = "closed";
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));

  await archivePeriod(periodData, target);

  await Bun.write(dataPath, "");
  console.log("✓ Current period data cleared");

  const msg = winner
    ? `Period closed — winner: @${winner.bidder} ($${winner.amount})`
    : "Period closed — no winner";
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
