import { mkdir } from "fs/promises";
import { resolve } from "path";
import type { BidMeConfig } from "../lib/config.ts";
import { loadConfig } from "../lib/config.ts";
import { logError } from "../lib/error-handler.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { generateNoBidsMessage, generateWinnerAnnouncement } from "../lib/issue-template.ts";
import { StripeAPI, StripePaymentError } from "../lib/stripe-integration.ts";
import type { BidRecord, PeriodData } from "../lib/types.ts";
import {
  readAnalytics,
  readCurrentPeriod,
  writeAnalytics,
  writeCurrentPeriod,
} from "../lib/variable-store.ts";

export interface CloseBiddingOptions {
  target?: string;
}

export function appendTrackingParams(
  destinationUrl: string,
  owner: string,
  repo: string,
  paramsTemplate = "utm_source=bidme&utm_campaign={owner}/{repo}",
): string {
  const params = paramsTemplate.replace("{owner}", owner).replace("{repo}", repo);
  if (destinationUrl.includes("?")) {
    return `${destinationUrl}&${params}`;
  }
  return `${destinationUrl}?${params}`;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/gif": "gif",
};

interface DownloadedBanner {
  bytes: Buffer;
  ext: string;
}

async function downloadBanner(
  url: string,
  allowedFormats: string[],
): Promise<DownloadedBanner | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    const urlExt = new URL(url).pathname.split(".").pop() ?? "";
    const ext = MIME_TO_EXT[contentType] ?? (allowedFormats.includes(urlExt) ? urlExt : "png");
    if (!allowedFormats.includes(ext)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return { bytes, ext };
  } catch {
    return null;
  }
}

function buildWinnerBannerBlock(
  winner: BidRecord,
  periodData: PeriodData,
  bannerPath: string,
  trackingUrl: string,
): string {
  const alt = winner.tagline ?? "BIDME Banner";
  const issueUrl =
    periodData.issue_url ??
    `https://github.com/dan-dr/bidme-test/issues/${periodData.issue_number}`;
  const bidLink = `${issueUrl}#issuecomment-${winner.comment_id}`;
  return [
    `[![${alt}](${bannerPath})](${trackingUrl})`,
    "",
    `<sub>Sponsored via [BIDME](https://github.com/danarrib/bidme) — [view winning bid](${bidLink})</sub>`,
  ].join("\n");
}

interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

async function processPayment(
  winner: BidRecord,
  periodData: PeriodData,
  config: BidMeConfig,
): Promise<{ payment: PeriodData["payment"] | null; paymentResult: PaymentResult }> {
  const stripeApi = new StripeAPI();
  if (!stripeApi.isConfigured) {
    console.log("⚠ Stripe not configured — skipping payment processing");
    return { payment: null, paymentResult: { success: false, error: "Stripe not configured" } };
  }

  const customers = await stripeApi.searchCustomersByMetadata(winner.bidder);
  const customerId = customers[0]?.id;
  const paymentMethods = customerId ? await stripeApi.listPaymentMethods(customerId) : [];
  const paymentMethodId = paymentMethods[0]?.id;

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
    const destination =
      config.payment.mode === "connect" ? config.payment.stripe_account_id : undefined;
    const fee = destination
      ? Math.round(amountCents * (config.payment.bidme_fee_percent / 100))
      : undefined;
    const paymentIntent = await stripeApi.chargeCustomer(
      customerId,
      paymentMethodId,
      amountCents,
      {
        period_id: periodData.period_id,
        bidder: winner.bidder,
        bid_amount: String(winner.amount),
      },
      destination,
      fee,
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
      paymentResult: {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
    };
  }
}

async function archivePeriodLocal(periodData: PeriodData, target: string): Promise<void> {
  const archiveDir = resolve(target, ".bidme/data/archive");
  await mkdir(archiveDir, { recursive: true });

  const dateStr = periodData.start_date.split("T")[0];
  const archivePath = resolve(archiveDir, `period-${dateStr}.json`);
  await Bun.write(archivePath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Period archived to ${archivePath}`);
}

interface WinnerPRArgs {
  api: GitHubAPI;
  prApi: GitHubAPI;
  periodData: PeriodData;
  winner: BidRecord;
  readmeContent: string;
  archiveJson: string;
  banner: DownloadedBanner | null;
  trackingUrl: string;
  paymentMessage: string;
}

async function createWinnerPR(args: WinnerPRArgs): Promise<{
  url: string;
  number: number;
} | null> {
  const {
    api,
    prApi,
    periodData,
    winner,
    readmeContent,
    archiveJson,
    banner,
    trackingUrl,
    paymentMessage,
  } = args;
  const branch = `bidme/winner-${periodData.period_id}`;
  const dateStr = periodData.start_date.split("T")[0];
  const bannerPath = banner
    ? `.bidme/banners/${periodData.period_id}.${banner.ext}`
    : winner.banner_url;

  const bannerBlock = buildWinnerBannerBlock(winner, periodData, bannerPath, trackingUrl);
  const updatedReadme = readmeContent.replace(
    /<!-- bidme-banner-start -->[\s\S]*?<!-- bidme-banner-end -->/,
    `<!-- bidme-banner-start -->\n${bannerBlock}\n<!-- bidme-banner-end -->`,
  );

  const issueUrl =
    periodData.issue_url ??
    `https://github.com/dan-dr/bidme-test/issues/${periodData.issue_number}`;
  const bidLink = `${issueUrl}#issuecomment-${winner.comment_id}`;

  try {
    const baseSha = await api.getBranchSha("main");
    await api.createBranch(branch, baseSha);
    console.log(`✓ Created branch ${branch}`);

    if (banner) {
      await api.commitFileToBranch(
        branch,
        bannerPath,
        banner.bytes.toString("base64"),
        `chore(bidme): add winning banner for ${periodData.period_id}`,
      );
      console.log(`✓ Uploaded banner to ${bannerPath}`);
    }

    await api.commitFileToBranch(
      branch,
      "README.md",
      Buffer.from(updatedReadme).toString("base64"),
      `docs(bidme): update README banner for ${periodData.period_id}`,
    );
    console.log("✓ Updated README on branch");

    const archivePath = `.bidme/data/archive/period-${dateStr}.json`;
    await api.commitFileToBranch(
      branch,
      archivePath,
      Buffer.from(archiveJson).toString("base64"),
      `chore(bidme): archive period ${periodData.period_id}`,
    );
    console.log("✓ Archived period on branch");

    const prBody = `## 🏆 Winning banner — ${periodData.period_id}

| Detail | Value |
|--------|-------|
| Winner | @${winner.bidder} |
| Amount | $${winner.amount} |
| Tagline | ${winner.tagline ?? ""} |
| Destination | ${winner.destination_url} |
| Winning bid | ${bidLink} |
| Payment | ${paymentMessage} |

Merging this PR publishes the winning banner to the README and archives the period.

---
*Powered by [BIDME](https://github.com/danarrib/bidme)*`;

    const prTitle = `BIDME: Winning banner — @${winner.bidder} $${winner.amount} (${periodData.period_id})`;
    // Try BIDME_PAT first (works when the PAT has PR scope), then fall back to
    // GITHUB_TOKEN (works when the repo allows Actions to create PRs).
    let pr: { number: number; html_url: string };
    try {
      pr = await prApi.createPR(prTitle, prBody, branch, "main");
    } catch (patErr) {
      console.warn("⚠ BIDME_PAT could not create PR, retrying with GITHUB_TOKEN…");
      logError(patErr, "close-bidding:createWinnerPR:pat");
      pr = await api.createPR(prTitle, prBody, branch, "main");
    }
    console.log(`✓ Opened PR #${pr.number}: ${pr.html_url}`);
    return { url: pr.html_url, number: pr.number };
  } catch (err) {
    console.warn(
      "⚠ Failed to create winner PR — set BIDME_PAT (with pull-requests scope) or enable 'Allow GitHub Actions to create and approve pull requests' in repo Settings → Actions → General",
    );
    logError(err, "close-bidding:createWinnerPR");
    return null;
  }
}

export async function runCloseBidding(
  options: CloseBiddingOptions = {},
): Promise<{ success: boolean; message: string }> {
  const target = options.target ?? process.cwd();
  console.log("=== BIDME: Closing Bidding Period ===\n");

  const config = await loadConfig(target);
  console.log("✓ Config loaded");

  const periodData = await readCurrentPeriod();
  if (!periodData) {
    const msg = "No active bidding period found — nothing to close";
    console.log(`⚠ ${msg}`);
    return { success: true, message: msg };
  }

  if (periodData.status !== "open") {
    const msg = "Bidding period is not open";
    console.log(`✗ ${msg}`);
    return { success: false, message: msg };
  }

  console.log(`  Period: ${periodData.period_id}`);
  console.log(`  Total bids: ${periodData.bids.length}`);

  const activeBids = periodData.bids.filter((b) => b.status === "active");
  console.log(`  Active bids: ${activeBids.length}`);

  const winner =
    activeBids.length > 0 ? activeBids.reduce((max, b) => (b.amount > max.amount ? b : max)) : null;

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");

    if (winner) {
      const trackingUrl = appendTrackingParams(
        winner.destination_url,
        owner || "unknown",
        repo || "unknown",
        config.tracking.utm_params,
      );
      console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);
      console.log(`  Banner: ${winner.banner_url}`);
      console.log(`  Destination: ${trackingUrl}`);

      const { payment } = await processPayment(winner, periodData, config);
      if (payment) {
        periodData.payment = payment;
      }
    } else {
      console.log("\n✗ No active bids — no winner");
    }

    periodData.status = "closed";
    await archivePeriodLocal(periodData, target);
    await writeCurrentPeriod({});
    console.log("✓ BIDME_CURRENT_PERIOD cleared");

    const msg = winner
      ? `Period closed — winner: @${winner.bidder} ($${winner.amount})`
      : "Period closed — no winner";
    console.log(`\n✓ ${msg}`);
    return { success: true, message: msg };
  }

  const api = new GitHubAPI(owner, repo);
  const prApi = new GitHubAPI(owner, repo, process.env["BIDME_PAT"] ?? undefined);

  let stripePaymentSuccess = false;
  if (winner) {
    console.log(`\n✓ Winner: @${winner.bidder} with $${winner.amount}`);

    const { payment, paymentResult } = await processPayment(winner, periodData, config);
    if (payment) {
      periodData.payment = payment;
    }
    stripePaymentSuccess = paymentResult.success;

    const encodedDest = encodeURIComponent(
      appendTrackingParams(winner.destination_url, owner, repo, config.tracking.utm_params),
    );
    const pagesBase = config.payment.base_url || `https://${owner}.github.io/${repo}`;
    const trackingUrl = `${pagesBase}/.bidme/pay/redirect.html?id=${encodeURIComponent(periodData.period_id)}&dest=${encodedDest}`;
    console.log(`  Tracking URL: ${trackingUrl}`);

    const banner = await downloadBanner(winner.banner_url, config.banner.formats);
    if (banner) {
      console.log(`✓ Downloaded banner (${banner.ext}, ${banner.bytes.length} bytes)`);
    } else {
      console.warn("⚠ Could not download banner — PR will reference the external URL");
    }

    let readmeContent = "";
    try {
      readmeContent = await Bun.file(resolve(target, "README.md")).text();
    } catch (err) {
      console.warn("⚠ Could not read README.md — banner update skipped");
      logError(err, "close-bidding:readReadme");
    }

    periodData.status = "closed";
    const archiveJson = JSON.stringify(periodData, null, 2);

    const paymentMessage = stripePaymentSuccess
      ? "✅ Payment processed successfully"
      : "⏳ Payment pending — winner will be contacted";

    const pr = readmeContent
      ? await createWinnerPR({
          api,
          prApi,
          periodData,
          winner,
          readmeContent,
          archiveJson,
          banner,
          trackingUrl,
          paymentMessage,
        })
      : null;

    const announcement = generateWinnerAnnouncement(winner, periodData, paymentMessage);
    const announcementWithPR = pr
      ? `${announcement}\n\n> 📝 Banner change proposed in [PR #${pr.number}](${pr.url}). Merge to publish.`
      : announcement;
    try {
      await api.addComment(periodData.issue_number, announcementWithPR);
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

    periodData.status = "closed";
    const archiveJson = JSON.stringify(periodData, null, 2);
    const dateStr = periodData.start_date.split("T")[0];
    try {
      await api.commitFileToBranch(
        "main",
        `.bidme/data/archive/period-${dateStr}.json`,
        Buffer.from(archiveJson).toString("base64"),
        `chore(bidme): archive period ${periodData.period_id}`,
      );
      console.log("✓ Archived period to main");
    } catch (err) {
      console.warn("⚠ Failed to commit period archive");
      logError(err, "close-bidding:archiveCommit");
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

  const analytics = await readAnalytics();
  analytics.periods.push({
    period_id: periodData.period_id,
    winner: winner?.bidder,
    amount: winner?.amount,
    start_date: periodData.start_date,
    end_date: periodData.end_date,
    views: 0,
    clicks: analytics.clicks.filter((click) => click.banner_id === periodData.period_id).length,
    ctr: 0,
  });
  analytics.last_updated = new Date().toISOString();
  await writeAnalytics(analytics);

  await writeCurrentPeriod({});
  console.log("✓ BIDME_CURRENT_PERIOD cleared");

  const msg = winner
    ? `Period closed — winner: @${winner.bidder} ($${winner.amount})`
    : "Period closed — no winner";
  console.log(`\n✓ ${msg}`);
  return { success: true, message: msg };
}
