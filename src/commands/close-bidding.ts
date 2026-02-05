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
import { PolarAPI } from "../lib/polar-integration.ts";
import { logError, withRetry } from "../lib/error-handler.ts";
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

async function processPayment(
  winner: BidRecord,
  periodData: PeriodData,
): Promise<PeriodData["payment"] | null> {
  const polar = new PolarAPI();
  if (!polar.isConfigured) {
    console.log("⚠ Polar.sh not configured — skipping payment processing");
    return null;
  }

  try {
    const periodLabel = `${periodData.start_date.split("T")[0]} to ${periodData.end_date.split("T")[0]}`;

    const product = await withRetry(
      () =>
        polar.createProduct(
          `Banner Space: ${periodLabel} - $${winner.amount}`,
          winner.amount,
          `BidMe banner slot for period ${periodData.period_id}`,
        ),
      2,
      {
        delayMs: 2000,
        onRetry: (attempt, error) => {
          console.warn(`⚠ Polar product creation failed (attempt ${attempt}), retrying...`);
          logError(error, "close-bidding:createProduct");
        },
      },
    );
    console.log(`✓ Polar.sh product created: ${product.id}`);

    const checkout = await withRetry(
      () =>
        polar.createCheckoutSession(
          winner.amount,
          winner.contact,
          periodData.period_id,
        ),
      2,
      {
        delayMs: 2000,
        onRetry: (attempt, error) => {
          console.warn(`⚠ Polar checkout creation failed (attempt ${attempt}), retrying...`);
          logError(error, "close-bidding:createCheckout");
        },
      },
    );
    console.log(`✓ Polar.sh checkout session created: ${checkout.url}`);

    return {
      checkout_url: checkout.url,
      payment_status: "pending",
      product_id: product.id,
      checkout_id: checkout.id,
    };
  } catch (err) {
    console.error("⚠ Polar.sh payment processing failed:", err);
    logError(err, "close-bidding:processPayment");
    return null;
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

      const paymentResult = await processPayment(winner, periodData);
      if (paymentResult) {
        periodData.payment = paymentResult;
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

  if (winner) {
    console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);

    const paymentResult = await processPayment(winner, periodData);
    if (paymentResult) {
      periodData.payment = paymentResult;
    }

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
        await withRetry(
          () =>
            api.updateReadme(
              updatedReadme,
              `BidMe: Update banner — winner @${winner.bidder} ($${winner.amount})`,
            ),
          2,
          {
            onRetry: (attempt, error) => {
              console.warn(`⚠ README update failed (attempt ${attempt}), retrying...`);
              logError(error, "close-bidding:updateReadme");
            },
          },
        );
        console.log("✓ README updated with winning banner");
      } catch (err) {
        console.warn("⚠ Failed to update README after retries — banner not updated");
        logError(err, "close-bidding:updateReadme");
      }
    }

    const checkoutUrl = periodData.payment?.checkout_url;
    const announcement = generateWinnerAnnouncement(winner, periodData, checkoutUrl);
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
