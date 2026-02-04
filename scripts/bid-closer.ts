import { GitHubAPI } from "./utils/github-api";
import { generateBannerSection } from "./utils/badge-generator";
import {
  generateWinnerAnnouncement,
  generateNoBidsMessage,
} from "./utils/issue-template";
import { PolarAPI } from "./utils/polar-integration";
import type { PeriodData, BidRecord } from "./bid-opener";
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
    let readmeContent = await readmeFile.text();

    const bannerMarkdown = generateBannerSection(
      winner.banner_url,
      winner.destination_url,
      [],
    );

    readmeContent = readmeContent.replace(
      /<!-- BIDME:BANNER:START -->[\s\S]*?<!-- BIDME:BANNER:END -->/,
      `<!-- BIDME:BANNER:START -->\n${bannerMarkdown}\n<!-- BIDME:BANNER:END -->`,
    );

    await api.updateReadme(
      readmeContent,
      `BidMe: Update banner — winner @${winner.bidder} ($${winner.amount})`,
    );
    console.log("✓ README updated with winning banner");

    const checkoutUrl = periodData.payment?.checkout_url;
    const announcement = generateWinnerComment(winner, periodData, checkoutUrl);
    await api.addComment(periodData.issue_number, announcement);
    console.log("✓ Winner announcement posted");
  } else {
    const noWinnerMsg = generateNoWinnerComment(periodData);
    await api.addComment(periodData.issue_number, noWinnerMsg);
    console.log("✓ No-winner comment posted");
  }

  await api.unpinIssue(periodData.issue_node_id);
  console.log("✓ Issue unpinned");

  await api.closeIssue(periodData.issue_number);
  console.log("✓ Issue closed");

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
    const product = await polar.createProduct(
      `Banner Space: ${periodLabel} - $${winner.amount}`,
      winner.amount,
      `BidMe banner slot for period ${periodData.period_id}`,
    );
    console.log(`✓ Polar.sh product created: ${product.id}`);

    const checkout = await polar.createCheckoutSession(
      winner.amount,
      winner.contact,
      periodData.period_id,
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
    console.error("Error closing bidding period:", err);
    process.exit(1);
  });
}
