import yaml from "js-yaml";
import { resolve, dirname } from "path";
import { mkdir, readdir } from "fs/promises";
import { loadConfig, type BidMeConfig } from "./utils/config";

const DEFAULT_CONFIG_YAML = `bidding:
  schedule: "monthly"
  duration: 7
  minimum_bid: 50
  increment: 5

banner:
  width: 800
  height: 100
  format: "png,jpg,svg"
  max_size: 200
  position: "top"

content_guidelines:
  prohibited:
    - "adult content"
    - "gambling"
    - "misleading claims"
  required:
    - "alt text"
    - "clear branding"

analytics:
  display: true
  metrics:
    - views
    - countries
    - referrers
    - clicks
`;

const BANNER_MARKERS = `<!-- BIDME:BANNER:START -->
<!-- BIDME:BANNER:END -->`;

const WORKFLOW_FILES = [
  "schedule-bidding.yml",
  "process-bid.yml",
  "process-approval.yml",
  "close-bidding.yml",
  "update-analytics.yml",
];

const EMPTY_ANALYTICS = JSON.stringify(
  {
    periods: [],
    totals: { revenue: 0, bids: 0, periods: 0 },
    lastUpdated: null,
  },
  null,
  2,
);

const EMPTY_PERIOD = JSON.stringify(
  {
    status: "inactive",
    bids: [],
    createdAt: null,
    closedAt: null,
  },
  null,
  2,
);

export interface SetupResult {
  isGitRepo: boolean;
  hasOriginRemote: boolean;
  configCreated: boolean;
  readmeUpdated: boolean;
  dataDirectoryCreated: boolean;
  workflowsCopied: string[];
  dataFilesCreated: string[];
  warnings: string[];
}

async function detectGitRepo(cwd: string): Promise<{ isGitRepo: boolean; hasOrigin: boolean }> {
  const gitDir = resolve(cwd, ".git");
  const gitExists = await Bun.file(resolve(gitDir, "HEAD")).exists();
  if (!gitExists) {
    console.log("⚠ Not a Git repository — workflow installation skipped");
    return { isGitRepo: false, hasOrigin: false };
  }
  console.log("✓ Git repository detected");

  let hasOrigin = false;
  try {
    const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    hasOrigin = exitCode === 0;
  } catch {
    hasOrigin = false;
  }

  if (hasOrigin) {
    console.log("✓ Origin remote found");
  } else {
    console.log("⚠ No origin remote — push to GitHub before enabling Actions");
  }

  return { isGitRepo: true, hasOrigin };
}

async function ensureWorkflows(cwd: string): Promise<{ copied: string[] }> {
  const targetDir = resolve(cwd, ".github", "workflows");
  await mkdir(targetDir, { recursive: true });

  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const sourceDir = resolve(scriptDir, "..", ".github", "workflows");

  const copied: string[] = [];

  for (const file of WORKFLOW_FILES) {
    const targetPath = resolve(targetDir, file);
    if (await Bun.file(targetPath).exists()) {
      console.log(`✓ ${file} already exists`);
      continue;
    }

    const sourcePath = resolve(sourceDir, file);
    const sourceFile = Bun.file(sourcePath);
    if (!(await sourceFile.exists())) {
      console.log(`⚠ Source workflow ${file} not found — skipping`);
      continue;
    }

    const content = await sourceFile.text();
    await Bun.write(targetPath, content);
    copied.push(file);
    console.log(`✓ Copied ${file} to .github/workflows/`);
  }

  if (copied.length === 0) {
    console.log("✓ All workflow files already present");
  }

  return { copied };
}

async function ensureConfig(cwd: string): Promise<{ created: boolean }> {
  const configPath = resolve(cwd, "bidme-config.yml");
  const file = Bun.file(configPath);
  if (await file.exists()) {
    console.log("✓ bidme-config.yml already exists");
    return { created: false };
  }
  await Bun.write(configPath, DEFAULT_CONFIG_YAML);
  console.log("✓ Created bidme-config.yml with default settings");
  return { created: true };
}

async function ensureReadmeMarkers(cwd: string): Promise<{ updated: boolean }> {
  const readmePath = resolve(cwd, "README.md");
  const file = Bun.file(readmePath);
  if (!(await file.exists())) {
    const content = `# My Project\n\n${BANNER_MARKERS}\n`;
    await Bun.write(readmePath, content);
    console.log("✓ Created README.md with BidMe banner markers");
    return { updated: true };
  }
  const content = await file.text();
  if (content.includes("<!-- BIDME:BANNER:START -->")) {
    console.log("✓ README.md already has BidMe banner markers");
    return { updated: false };
  }
  const updated = `${BANNER_MARKERS}\n\n${content}`;
  await Bun.write(readmePath, updated);
  console.log("✓ Added BidMe banner markers to README.md");
  return { updated: true };
}

async function ensureDataDirectory(cwd: string): Promise<{ created: boolean; filesCreated: string[] }> {
  const dataPath = resolve(cwd, "data");
  await mkdir(dataPath, { recursive: true });
  const archivePath = resolve(dataPath, "archive");
  await mkdir(archivePath, { recursive: true });

  const filesCreated: string[] = [];

  const analyticsPath = resolve(dataPath, "analytics.json");
  if (!(await Bun.file(analyticsPath).exists())) {
    await Bun.write(analyticsPath, EMPTY_ANALYTICS);
    filesCreated.push("analytics.json");
    console.log("✓ Created data/analytics.json");
  } else {
    console.log("✓ data/analytics.json already exists");
  }

  const periodPath = resolve(dataPath, "current-period.json");
  if (!(await Bun.file(periodPath).exists())) {
    await Bun.write(periodPath, EMPTY_PERIOD);
    filesCreated.push("current-period.json");
    console.log("✓ Created data/current-period.json");
  } else {
    console.log("✓ data/current-period.json already exists");
  }

  console.log("✓ data/ directory ready");
  return { created: true, filesCreated };
}

function checkSecrets(): string[] {
  const warnings: string[] = [];
  console.log("\n📋 GitHub Secrets Checklist:");
  console.log("  [ ] POLAR_ACCESS_TOKEN — optional but recommended for payment processing");
  console.log("      → Get yours at https://polar.sh/settings");
  console.log("  [✓] GITHUB_TOKEN — automatically provided by GitHub Actions");
  warnings.push("POLAR_ACCESS_TOKEN is optional but recommended for payment processing");
  return warnings;
}

function printSummary(result: SetupResult): void {
  console.log("\n=== Setup Summary ===\n");
  console.log(`  Git repo:   ${result.isGitRepo ? "✓ Detected" : "✗ Not found"}`);
  console.log(`  Remote:     ${result.hasOriginRemote ? "✓ Origin set" : "✗ No origin"}`);
  console.log(`  Config:     ${result.configCreated ? "Created" : "Already exists"}`);
  console.log(`  README:     ${result.readmeUpdated ? "Updated" : "Already configured"}`);
  console.log(`  Data dir:   ${result.dataDirectoryCreated ? "Created" : "Ready"}`);
  console.log(`  Workflows:  ${result.workflowsCopied.length > 0 ? `Copied ${result.workflowsCopied.length} file(s)` : "Already present"}`);
  console.log(`  Data files: ${result.dataFilesCreated.length > 0 ? result.dataFilesCreated.join(", ") : "Already present"}`);

  console.log("\n📌 Next Steps:");
  const steps: string[] = [];
  if (!result.isGitRepo) {
    steps.push("Initialize a Git repo: git init && git remote add origin <url>");
  } else if (!result.hasOriginRemote) {
    steps.push("Add a remote: git remote add origin <your-github-repo-url>");
  }
  steps.push("Edit bidme-config.yml to customize bidding parameters");
  steps.push("Push to GitHub and enable Actions in your repository settings");
  steps.push("(Optional) Set POLAR_ACCESS_TOKEN secret for payment processing");
  steps.push("The first bidding period will open on the configured schedule");

  steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
  console.log();
}

export async function setup(cwd?: string): Promise<SetupResult> {
  const workingDir = cwd ?? process.cwd();
  console.log("=== BidMe: Setup ===\n");

  const gitResult = await detectGitRepo(workingDir);
  const workflowResult = gitResult.isGitRepo
    ? await ensureWorkflows(workingDir)
    : { copied: [] };
  const configResult = await ensureConfig(workingDir);
  const readmeResult = await ensureReadmeMarkers(workingDir);
  const dataResult = await ensureDataDirectory(workingDir);
  const warnings = checkSecrets();

  const result: SetupResult = {
    isGitRepo: gitResult.isGitRepo,
    hasOriginRemote: gitResult.hasOrigin,
    configCreated: configResult.created,
    readmeUpdated: readmeResult.updated,
    dataDirectoryCreated: dataResult.created,
    workflowsCopied: workflowResult.copied,
    dataFilesCreated: dataResult.filesCreated,
    warnings,
  };

  printSummary(result);
  return result;
}

if (import.meta.main) {
  setup().catch((err) => {
    console.error("Error running setup:", err);
    process.exit(1);
  });
}
