import { join, resolve } from "path";
import * as clack from "@clack/prompts";

const WORKFLOW_FILES = [
  "bidme-schedule.yml",
  "bidme-process-bid.yml",
  "bidme-process-approval.yml",
  "bidme-close-bidding.yml",
  "bidme-check-grace.yml",
  "bidme-analytics.yml",
  "bidme-daily-recap.yml",
  "bidme-e2e-test.yml",
];

const BANNER_START = "<!-- BIDME:BANNER:START -->";
const BANNER_END = "<!-- BIDME:BANNER:END -->";

export interface RemoveOptions {
  target: string;
  force?: boolean;
}

export interface RemoveResult {
  success: boolean;
  removed: string[];
}

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function removeFile(path: string): Promise<boolean> {
  const fs = await import("fs/promises");
  try {
    await fs.unlink(path);
    return true;
  } catch {
    return false;
  }
}

async function removeDir(path: string): Promise<boolean> {
  const fs = await import("fs/promises");
  try {
    await fs.rm(path, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function cleanReadme(target: string): Promise<boolean> {
  const readmePath = join(target, "README.md");
  if (!(await fileExists(readmePath))) return false;

  const content = await Bun.file(readmePath).text();
  const startIdx = content.indexOf(BANNER_START);
  const endIdx = content.indexOf(BANNER_END);
  if (startIdx === -1 || endIdx === -1) return false;

  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + BANNER_END.length);
  const cleaned = (before + after).replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
  await Bun.write(readmePath, cleaned);
  return true;
}

export async function runRemove(options: RemoveOptions): Promise<RemoveResult> {
  const target = resolve(options.target);
  const removed: string[] = [];

  console.log("\n=== BidMe: Remove ===\n");

  const bidmeDir = join(target, ".bidme");
  if (!(await fileExists(join(bidmeDir, "config.toml")))) {
    console.log("No BidMe installation found in this directory.");
    return { success: true, removed };
  }

  if (!options.force) {
    clack.intro("Remove BidMe from this repository");

    const confirm = await clack.confirm({
      message: "This will remove all BidMe files (.bidme/, workflows, README banner). Continue?",
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.outro("Cancelled.");
      return { success: true, removed };
    }
  }

  // Remove workflows
  const workflowDir = join(target, ".github", "workflows");
  for (const wf of WORKFLOW_FILES) {
    const path = join(workflowDir, wf);
    if (await removeFile(path)) {
      removed.push(`.github/workflows/${wf}`);
    }
  }

  // Remove .bidme/ directory
  if (await removeDir(bidmeDir)) {
    removed.push(".bidme/");
  }

  // Clean README banner placeholder
  if (await cleanReadme(target)) {
    removed.push("README.md (banner removed)");
  }

  console.log(`\nRemoved ${removed.length} items:`);
  for (const item of removed) {
    console.log(`  - ${item}`);
  }
  console.log("\nDon't forget to commit and push the changes.");

  return { success: true, removed };
}
