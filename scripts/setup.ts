import yaml from "js-yaml";
import { resolve } from "path";
import { mkdir } from "fs/promises";
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

export interface SetupResult {
  configCreated: boolean;
  readmeUpdated: boolean;
  dataDirectoryCreated: boolean;
  warnings: string[];
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

async function ensureDataDirectory(cwd: string): Promise<{ created: boolean }> {
  const dataPath = resolve(cwd, "data");
  const file = Bun.file(dataPath);
  try {
    await mkdir(dataPath, { recursive: true });
  } catch {
    // directory exists
  }
  const archivePath = resolve(dataPath, "archive");
  try {
    await mkdir(archivePath, { recursive: true });
  } catch {
    // directory exists
  }
  console.log("✓ data/ directory ready");
  return { created: true };
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
  console.log(`  Config:    ${result.configCreated ? "Created" : "Already exists"}`);
  console.log(`  README:    ${result.readmeUpdated ? "Updated" : "Already configured"}`);
  console.log(`  Data dir:  ${result.dataDirectoryCreated ? "Created" : "Ready"}`);
  console.log("\n📌 Next Steps:");
  console.log("  1. Edit bidme-config.yml to customize bidding parameters");
  console.log("  2. Push to GitHub and enable Actions in your repository settings");
  console.log("  3. (Optional) Set POLAR_ACCESS_TOKEN secret for payment processing");
  console.log("  4. The first bidding period will open on the configured schedule\n");
}

export async function setup(cwd?: string): Promise<SetupResult> {
  const workingDir = cwd ?? process.cwd();
  console.log("=== BidMe: Setup ===\n");

  const configResult = await ensureConfig(workingDir);
  const readmeResult = await ensureReadmeMarkers(workingDir);
  const dataResult = await ensureDataDirectory(workingDir);
  const warnings = checkSecrets();

  const result: SetupResult = {
    configCreated: configResult.created,
    readmeUpdated: readmeResult.updated,
    dataDirectoryCreated: dataResult.created,
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
