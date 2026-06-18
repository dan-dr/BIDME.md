import { loadConfig } from "../lib/config.ts";
import { GitHubAPI } from "../lib/github-api.ts";
import { generateBiddingIssueBody } from "../lib/issue-template.ts";
import { logError, withRetry } from "../lib/error-handler.ts";
import { readAnalytics, writeCurrentPeriod } from "../lib/variable-store.ts";
import type { PeriodData } from "../lib/types.ts";

export interface OpenBiddingOptions {
  target?: string;
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`;
}

export async function runOpenBidding(options: OpenBiddingOptions = {}): Promise<void> {
  const target = options.target ?? process.cwd();
  console.log("=== BidMe: Opening New Bidding Period ===\n");

  const config = await loadConfig(target);
  console.log("✓ Config loaded");
  console.log(`  Schedule: ${config.bidding.schedule}`);
  console.log(`  Duration: ${config.bidding.duration} days`);
  console.log(`  Minimum bid: $${config.bidding.minimum_bid}`);

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + config.bidding.duration);

  const dateRange = formatDateRange(startDate, endDate);
  const title = `🎯 BidMe: Banner Bidding [${dateRange}]`;
  console.log(`\n✓ Bidding period: ${dateRange}`);

  const analytics = await readAnalytics();
  const previousStats = analytics.periods.length > 0
    ? analytics.periods[analytics.periods.length - 1]
    : undefined;

  const periodStub: PeriodData = {
    period_id: `period-${startDate.toISOString().split("T")[0]}`,
    status: "open",
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    issue_number: 0,
    bids: [],
    created_at: new Date().toISOString(),
  };

  const body = generateBiddingIssueBody(periodStub, config, [], previousStats);

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY)");
    console.log("  Would create issue:", title);
    console.log("  Issue body preview (first 200 chars):", body.slice(0, 200) + "...");

    await writeCurrentPeriod(periodStub);
    return;
  }

  const api = new GitHubAPI(owner, repo);

  const issue = await withRetry(
    () => api.createIssue(title, body, ["bidme"]),
    2,
    {
      onRetry: (attempt, error) => {
        console.warn(`⚠ Issue creation failed (attempt ${attempt}), retrying...`);
        logError(error, "open-bidding:createIssue");
      },
    },
  );
  console.log(`\n✓ Issue created: #${issue.number} — ${issue.html_url}`);

  try {
    await api.pinIssue(issue.node_id);
    console.log("✓ Issue pinned");
  } catch (err) {
    console.warn("⚠ Failed to pin issue — continuing without pin");
    logError(err, "open-bidding:pinIssue");
  }

  const periodData: PeriodData = {
    period_id: periodStub.period_id,
    status: "open",
    start_date: periodStub.start_date,
    end_date: periodStub.end_date,
    issue_number: issue.number,
    issue_url: issue.html_url,
    issue_node_id: issue.node_id,
    bids: [],
    created_at: periodStub.created_at,
  };

  await writeCurrentPeriod(periodData);
  console.log("✓ Period data saved to BIDME_CURRENT_PERIOD");

  console.log("\n=== Bidding Period Opened Successfully ===");
}
