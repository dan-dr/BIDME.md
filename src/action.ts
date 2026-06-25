#!/usr/bin/env bun
import { resolve } from "path";

function requiredInput(name: string): string {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  if (!value?.trim()) {
    throw new Error(`Missing required input: ${name}`);
  }
  return value;
}

function optionalInput(name: string, fallback = ""): string {
  return process.env[`INPUT_${name.toUpperCase()}`] || fallback;
}

async function main(): Promise<void> {
  const command = requiredInput("command");
  const target = resolve(optionalInput("target", "."));

  switch (command) {
    case "open-bidding": {
      const { runOpenBidding } = await import("./commands/open-bidding.js");
      await runOpenBidding({ target });
      break;
    }
    case "process-bid": {
      const issue = Number(requiredInput("issue"));
      const comment = Number(requiredInput("comment"));
      if (!Number.isInteger(issue) || !Number.isInteger(comment)) {
        throw new Error("process-bid requires numeric issue and comment inputs");
      }
      const { runProcessBid } = await import("./commands/process-bid.js");
      const result = await runProcessBid(issue, comment, { target });
      if (!result.success) process.exitCode = 1;
      break;
    }
    case "close-bidding": {
      const { runCloseBidding } = await import("./commands/close-bidding.js");
      const result = await runCloseBidding({ target });
      if (!result.success) process.exitCode = 1;
      break;
    }
    case "update-analytics": {
      const { runUpdateAnalytics } = await import("./commands/update-analytics.js");
      const result = await runUpdateAnalytics({ target });
      if (!result.success) process.exitCode = 1;
      break;
    }
    default:
      throw new Error(`Unknown BIDME action command: ${command}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
