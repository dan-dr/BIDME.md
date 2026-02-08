#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  const pkgPath = resolve(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

const program = new Command();

program
  .name("bidme")
  .description("BidMe — sponsor banner bidding for GitHub READMEs")
  .version(getVersion(), "-v, --version", "Print the current version");

program
  .command("init")
  .description("Interactive setup wizard to scaffold .bidme/ config")
  .option("--target <path>", "Target directory to scaffold into", process.cwd())
  .option("--defaults", "Skip interactive prompts and use all defaults", false)
  .action(async (options: { target: string; defaults: boolean }) => {
    const { runInit } = await import("./commands/init.js");
    await runInit({
      target: resolve(options.target),
      useDefaults: options.defaults,
    });
  });

program
  .command("open-bidding")
  .description("Open a new bidding period — creates a pinned GitHub issue")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runOpenBidding } = await import("./commands/open-bidding.js");
    await runOpenBidding({ target: resolve(options.target) });
  });

program
  .command("process-bid")
  .description("Process a bid comment on the active bidding issue")
  .argument("<issue>", "Issue number", (val: string) => parseInt(val, 10))
  .argument("<comment>", "Comment ID", (val: string) => parseInt(val, 10))
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (issue: number, comment: number, options: { target: string }) => {
    const { runProcessBid } = await import("./commands/process-bid.js");
    const result = await runProcessBid(issue, comment, { target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("process-approval")
  .description("Process bid approval based on owner emoji reaction")
  .argument("<issue>", "Issue number", (val: string) => parseInt(val, 10))
  .argument("<comment>", "Comment ID of the bid to approve/reject", (val: string) => parseInt(val, 10))
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (issue: number, comment: number, options: { target: string }) => {
    const { runProcessApproval } = await import("./commands/process-approval.js");
    const result = await runProcessApproval(issue, comment, { target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("close-bidding")
  .description("Close the active bidding period — select winner, update README, archive")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runCloseBidding } = await import("./commands/close-bidding.js");
    const result = await runCloseBidding({ target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("check-grace")
  .description("Check grace periods for unlinked bidders — restore or expire bids")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runCheckGrace } = await import("./commands/check-grace.js");
    const result = await runCheckGrace({ target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("update-analytics")
  .description("Fetch GitHub traffic data and update analytics")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runUpdateAnalytics } = await import("./commands/update-analytics.js");
    const result = await runUpdateAnalytics({ target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("daily-recap")
  .description("Generate a daily recap of analytics and bidding activity")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runDailyRecap } = await import("./commands/daily-recap.js");
    const result = await runDailyRecap({ target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("setup-payment")
  .description("Create a Stripe Checkout session for a bidder to set up payment")
  .argument("<username>", "GitHub username of the bidder")
  .argument("<issue>", "Issue number to post the payment link", (val: string) => parseInt(val, 10))
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (username: string, issue: number, options: { target: string }) => {
    const { runSetupPayment } = await import("./commands/setup-payment.js");
    const result = await runSetupPayment(username, issue, { target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("remove")
  .description("Remove BidMe from the repository — deletes .bidme/, workflows, and README banner")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .option("--force", "Skip confirmation prompt", false)
  .action(async (options: { target: string; force: boolean }) => {
    const { runRemove } = await import("./commands/remove.js");
    const result = await runRemove({ target: resolve(options.target), force: options.force });
    if (!result.success) {
      process.exit(1);
    }
  });

program
  .command("update")
  .description("Update BidMe installation — run migrations and upgrade config")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runUpdate } = await import("./commands/update.js");
    const result = await runUpdate({ target: resolve(options.target) });
    if (!result.success) {
      process.exit(1);
    }
  });

program.parse();
