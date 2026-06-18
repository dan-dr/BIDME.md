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
  .command("doctor")
  .description("Verify BidMe repository, GitHub, Pages, and Stripe setup")
  .option("--target <path>", "Target directory with .bidme/ config", process.cwd())
  .action(async (options: { target: string }) => {
    const { runDoctor } = await import("./commands/doctor.js");
    const result = await runDoctor({ target: resolve(options.target) });
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
