import { GitHubAPI } from "./utils/github-api.ts";
import { generateBannerSection } from "./utils/badge-generator.ts";
import {
  generateWinnerAnnouncement,
  generateNoBidsMessage,
} from "./utils/issue-template.ts";
import { PolarAPI } from "./utils/polar-integration.ts";
import { logError, withRetry } from "./utils/error-handler.ts";
import type { PeriodData, BidRecord } from "./bid-opener.ts";
import { resolve } from "path";
import { mkdir } from "fs/promises";

export async function closeBiddingPeriod(): Promise<{
  success: boolean;
  message: string;
}> {
  console.log("=== BidMe: Closing Bidding Period ===\n");

  const dataPath = resolve(process.cwd(), "data/current-period.json");
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
    logError(err, "bid-closer:parsePeriodData");
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
  const repo = process.env["GITHUB_REPOSITORY"]?.split("/")[1] ?? "";

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");

    if (winner) {
      console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);
      console.log(`  Banner: ${winner.banner_url}`);
      console.log(`  Destination: ${winner.destination_url}`);

      const paymentResult = await processPayment(winner, periodData);
      if (paymentResult) {
        periodData.payment = paymentResult;
      }
    } else {
      console.log("\n✗ No approved bids — no winner");
    }

    periodData.status = "closed";
    await Bun.write(dataPath, JSON.stringify(periodData, null, 2));

    await archivePeriod(periodData);

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

    const readmePath = resolve(process.cwd(), "README.md");
    const readmeFile = Bun.file(readmePath);
    let readmeContent: string;

    try {
      readmeContent = await readmeFile.text();
    } catch (err) {
      console.warn("⚠ Could not read README.md — skipping banner update");
      logError(err, "bid-closer:readReadme");
      readmeContent = "";
    }

    if (readmeContent) {
      const bannerMarkdown = generateBannerSection(
        winner.banner_url,
        winner.destination_url,
        [],
      );

      const updatedReadme = readmeContent.replace(
        /<!-- BIDME:BANNER:START -->[\s\S]*?<!-- BIDME:BANNER:END -->/,
        `<!-- BIDME:BANNER:START -->\n${bannerMarkdown}\n<!-- BIDME:BANNER:END -->`,
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
              logError(error, "bid-closer:updateReadme");
            },
          },
        );
        console.log("✓ README updated with winning banner");
      } catch (err) {
        console.warn("⚠ Failed to update README after retries — banner not updated");
        logError(err, "bid-closer:updateReadme");
      }
    }

    const checkoutUrl = periodData.payment?.checkout_url;
    const announcement = generateWinnerComment(winner, periodData, checkoutUrl);
    try {
      await api.addComment(periodData.issue_number, announcement);
      console.log("✓ Winner announcement posted");
    } catch (err) {
      console.warn("⚠ Failed to post winner announcement");
      logError(err, "bid-closer:winnerComment");
    }
  } else {
    const noWinnerMsg = generateNoWinnerComment(periodData);
    try {
      await api.addComment(periodData.issue_number, noWinnerMsg);
      console.log("✓ No-winner comment posted");
    } catch (err) {
      console.warn("⚠ Failed to post no-winner comment");
      logError(err, "bid-closer:noWinnerComment");
    }
  }

  try {
    await api.unpinIssue(periodData.issue_node_id);
    console.log("✓ Issue unpinned");
  } catch (err) {
    console.warn("⚠ Failed to unpin issue — continuing");
    logError(err, "bid-closer:unpinIssue");
  }

  try {
    await api.closeIssue(periodData.issue_number);
    console.log("✓ Issue closed");
  } catch (err) {
    console.warn("⚠ Failed to close issue");
    logError(err, "bid-closer:closeIssue");
  }

  periodData.status = "closed";
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));

  await archivePeriod(periodData);

  await Bun.write(dataPath, "");
  console.log("✓ Current period data cleared");

  const msg = winner
    ? `Period closed — winner: @${winner.bidder} ($${winner.amount})`
    : "Period closed — no winner";
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}

function generateWinnerComment(bid: BidRecord, period: PeriodData, checkoutUrl?: string): string {
  return generateWinnerAnnouncement(bid, period, checkoutUrl);
}

function generateNoWinnerComment(period: PeriodData): string {
  return generateNoBidsMessage(period);
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
          logError(error, "bid-closer:createProduct");
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
          logError(error, "bid-closer:createCheckout");
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
    logError(err, "bid-closer:processPayment");
    return null;
  }
}

async function archivePeriod(periodData: PeriodData): Promise<void> {
  const archiveDir = resolve(process.cwd(), "data/archive");
  await mkdir(archiveDir, { recursive: true });

  const dateStr = periodData.start_date.split("T")[0];
  const archivePath = resolve(archiveDir, `period-${dateStr}.json`);
  await Bun.write(archivePath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Period archived to ${archivePath}`);
}

export { generateWinnerComment, generateNoWinnerComment, archivePeriod, processPayment };

if (import.meta.main) {
  closeBiddingPeriod().catch((err) => {
    logError(err, "bid-closer:main");
    process.exit(1);
  });
}
