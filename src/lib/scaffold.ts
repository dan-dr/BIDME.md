import { join, resolve } from "path";
import { type BidMeConfig, generateToml } from "./config.js";

const BANNER_START = "<!-- BIDME:BANNER:START -->";
const BANNER_END = "<!-- BIDME:BANNER:END -->";

const EMPTY_PERIOD = JSON.stringify(
  { period: null, bids: [], status: "inactive" },
  null,
  2,
);

const EMPTY_ANALYTICS = JSON.stringify(
  { periods: [], total_revenue: 0, total_bids: 0 },
  null,
  2,
);

const EMPTY_BIDDERS = JSON.stringify(
  { bidders: {} },
  null,
  2,
);

function bannerPlaceholder(owner: string, repo: string): string {
  const issueUrl = `https://github.com/${owner}/${repo}/issues?q=label%3Abidme`;
  return [
    BANNER_START,
    `[![Sponsored via BidMe](https://img.shields.io/badge/Sponsored%20via-BidMe-blue)](${issueUrl})`,
    "",
    `[Sponsored via BidMe](${issueUrl})`,
    BANNER_END,
  ].join("\n");
}

async function detectGitRepo(
  target: string,
): Promise<{ isGit: boolean; owner: string; repo: string }> {
  const gitDir = join(target, ".git");
  const fs = await import("fs/promises");
  let isDir = false;
  try {
    const s = await fs.stat(gitDir);
    isDir = s.isDirectory();
  } catch {
    isDir = false;
  }

  if (!isDir) return { isGit: false, owner: "OWNER", repo: "REPO" };

  try {
    const configPath = join(gitDir, "config");
    const configContent = await Bun.file(configPath).text();
    const match = configContent.match(
      /url\s*=\s*.*?(?:github\.com)[:/]([^/\s]+)\/([^/\s.]+)/,
    );
    if (match && match[1] && match[2]) {
      return {
        isGit: true,
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  } catch {
    // ignore
  }

  return { isGit: true, owner: "OWNER", repo: "REPO" };
}

async function ensureDir(dirPath: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeIfNotExists(filePath: string, content: string): Promise<void> {
  const file = Bun.file(filePath);
  if (await file.exists()) return;
  await Bun.write(filePath, content);
}

async function copyRedirectPage(target: string): Promise<boolean> {
  const bidmeDir = join(target, ".bidme");
  await ensureDir(bidmeDir);

  const templatePath = resolve(import.meta.dir, "../../templates/redirect.html");
  const destPath = join(bidmeDir, "redirect.html");

  const destFile = Bun.file(destPath);
  if (await destFile.exists()) return false;

  try {
    const content = await Bun.file(templatePath).text();
    await Bun.write(destPath, content);
    return true;
  } catch {
    return false;
  }
}

async function copyWorkflowTemplates(target: string): Promise<string[]> {
  const workflowDir = join(target, ".github", "workflows");
  await ensureDir(workflowDir);

  const templatesDir = resolve(import.meta.dir, "../../templates/workflows");
  const fs = await import("fs/promises");

  let entries: string[];
  try {
    entries = (await fs.readdir(templatesDir)).filter((f) => f.endsWith(".yml"));
  } catch {
    return [];
  }

  const copied: string[] = [];
  for (const entry of entries) {
    const src = join(templatesDir, entry);
    const dest = join(workflowDir, entry);
    const destFile = Bun.file(dest);
    if (await destFile.exists()) {
      console.log(`  Skipped ${entry} (already exists)`);
      continue;
    }
    const content = await Bun.file(src).text();
    await Bun.write(dest, content);
    copied.push(entry);
  }
  return copied;
}

async function updateReadme(
  target: string,
  owner: string,
  repo: string,
): Promise<void> {
  const readmePath = join(target, "README.md");
  const placeholder = bannerPlaceholder(owner, repo);
  const file = Bun.file(readmePath);

  if (await file.exists()) {
    const content = await file.text();
    if (content.includes(BANNER_START)) return;
    await Bun.write(readmePath, placeholder + "\n\n" + content);
  } else {
    await Bun.write(readmePath, placeholder + "\n");
  }
}

export async function scaffold(
  target: string,
  config: BidMeConfig,
): Promise<void> {
  const resolved = resolve(target);

  const bidmeDir = join(resolved, ".bidme");
  const dataDir = join(bidmeDir, "data");
  const archiveDir = join(dataDir, "archive");

  await ensureDir(archiveDir);

  const toml = generateToml(config);
  await writeIfNotExists(join(bidmeDir, "config.toml"), toml);
  await writeIfNotExists(join(dataDir, "current-period.json"), EMPTY_PERIOD);
  await writeIfNotExists(join(dataDir, "analytics.json"), EMPTY_ANALYTICS);
  await writeIfNotExists(join(dataDir, "bidders.json"), EMPTY_BIDDERS);

  const { isGit, owner, repo } = await detectGitRepo(resolved);

  if (isGit) {
    await copyWorkflowTemplates(resolved);
  }

  await copyRedirectPage(resolved);
  await updateReadme(resolved, owner, repo);
}
