import { loadConfig } from "./utils/config.ts";
import { GitHubAPI } from "./utils/github-api.ts";
import { generateBiddingIssueBody } from "./utils/issue-template.ts";
import { BidMeError, logError, withRetry } from "./utils/error-handler.ts";
import { resolve } from "path";

export interface PeriodData {
  period_id: string;
  start_date: string;
  end_date: string;
  issue_number: number;
  issue_node_id: string;
  status: "open" | "closed";
  bids: BidRecord[];
  payment?: {
    checkout_url: string;
    payment_status: "pending" | "paid" | "expired";
    product_id?: string;
    checkout_id?: string;
  };
}

export interface BidRecord {
  bidder: string;
  amount: number;
  banner_url: string;
  destination_url: string;
  contact: string;
  status: "pending" | "approved" | "rejected";
  comment_id: number;
  timestamp: string;
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const year = end.getFullYear();
  return `${fmt(start)} - ${fmt(end)}, ${year}`;
}

function generateIssueBody(
  startDate: Date,
  endDate: Date,
  config: Awaited<ReturnType<typeof loadConfig>>,
): string {
  const period: PeriodData = {
    period_id: `period-${startDate.toISOString().split("T")[0]}`,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    issue_number: 0,
    issue_node_id: "",
    status: "open",
    bids: [],
  };
  return generateBiddingIssueBody(period, config, []);
}

export async function openBiddingPeriod(configPath?: string): Promise<void> {
  console.log("=== BidMe: Opening New Bidding Period ===\n");

  let config;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    console.warn("⚠ Config file missing or invalid — using defaults");
    logError(err, "bid-opener:loadConfig");
    config = await loadConfig(undefined);
  }
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

  const body = generateIssueBody(startDate, endDate, config);

  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const repo = process.env["GITHUB_REPOSITORY"]?.split("/")[1] ?? "";

  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY)");
    console.log("  Would create issue:", title);
    console.log("  Issue body preview (first 200 chars):", body.slice(0, 200) + "...");

    const periodData: PeriodData = {
      period_id: `period-${startDate.toISOString().split("T")[0]}`,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      issue_number: 0,
      issue_node_id: "",
      status: "open",
      bids: [],
    };

    const dataPath = resolve(process.cwd(), "data/current-period.json");
    await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
    console.log(`\n✓ Period data saved to ${dataPath}`);
    return;
  }

  const api = new GitHubAPI(owner, repo);

  const issue = await withRetry(
    () => api.createIssue(title, body, ["bidme"]),
    2,
    {
      onRetry: (attempt, error) => {
        console.warn(`⚠ Issue creation failed (attempt ${attempt}), retrying...`);
        logError(error, "bid-opener:createIssue");
      },
    },
  );
  console.log(`\n✓ Issue created: #${issue.number} — ${issue.html_url}`);

  try {
    await api.pinIssue(issue.node_id);
    console.log("✓ Issue pinned");
  } catch (err) {
    console.warn("⚠ Failed to pin issue — continuing without pin");
    logError(err, "bid-opener:pinIssue");
  }

  const periodData: PeriodData = {
    period_id: `period-${startDate.toISOString().split("T")[0]}`,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    issue_number: issue.number,
    issue_node_id: issue.node_id,
    status: "open",
    bids: [],
  };

  const dataPath = resolve(process.cwd(), "data/current-period.json");
  await Bun.write(dataPath, JSON.stringify(periodData, null, 2));
  console.log(`✓ Period data saved to ${dataPath}`);

  console.log("\n=== Bidding Period Opened Successfully ===");
}

if (import.meta.main) {
  openBiddingPeriod().catch((err) => {
    logError(err, "bid-opener:main");
    process.exit(1);
  });
}
