import { join, resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { type BidMeConfig, generateToml } from "./config.js";

function resolveTemplate(...segments: string[]): string {
  const fromSource = resolve(import.meta.dir, "../../templates", ...segments);
  if (existsSync(fromSource)) return fromSource;
  return resolve(import.meta.dir, "../templates", ...segments);
}

export interface ScaffoldResult {
  configCreated: boolean;
  archiveCreated: boolean;
  dataFilesCreated: string[];
  workflowsCopied: string[];
  workflowsSkipped: string[];
  redirectCopied: boolean;
  notFoundCopied: boolean;
  stripePagesCopied: string[];
  pagesConfigCreated: boolean;
  readmeUpdated: boolean;
  versionCreated: boolean;
  owner: string;
  repo: string;
}

const BANNER_START = "<!-- bidme-banner-start -->";
const PUBLIC_PAY_DIR = ".bidme/pay";

function bannerPlaceholder(owner: string, repo: string): string {
  const issueUrl = `https://github.com/${owner}/${repo}/issues?q=label%3Abidme`;
  return [
    "<!-- bidme-banner-start -->",
    `[![Your Ad Here](https://img.shields.io/badge/Your_Ad_Here-BIDME-22c55e?style=for-the-badge)](${issueUrl})`,
    "<!-- bidme-banner-end -->",
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

async function writeIfNotExists(filePath: string, content: string): Promise<boolean> {
  const file = Bun.file(filePath);
  if (await file.exists()) return false;
  await Bun.write(filePath, content);
  return true;
}

async function copyRedirectPage(target: string): Promise<boolean> {
  const publicBidmeDir = join(target, PUBLIC_PAY_DIR);
  await ensureDir(publicBidmeDir);

  const templatePath = resolveTemplate("redirect.html");
  const destPath = join(publicBidmeDir, "redirect.html");

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

async function copyNotFoundPage(target: string): Promise<boolean> {
  const templatePath = resolveTemplate("404.html");
  const destPath = join(target, "404.html");

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

async function copyStripePages(
  target: string,
  owner: string,
  repo: string,
): Promise<string[]> {
  const stripeDir = join(target, PUBLIC_PAY_DIR, "stripe");
  await ensureDir(stripeDir);

  const templatesDir = resolveTemplate("stripe");
  const fs = await import("fs/promises");

  let entries: string[];
  try {
    entries = (await fs.readdir(templatesDir)).filter((f) => f.endsWith(".html"));
  } catch {
    return [];
  }

  const repoUrl = `https://github.com/${owner}/${repo}`;
  const copied: string[] = [];

  for (const entry of entries) {
    const dest = join(stripeDir, entry);
    const destFile = Bun.file(dest);
    if (await destFile.exists()) continue;

    let content = await Bun.file(join(templatesDir, entry)).text();
    content = content
      .replace(/\{\{REPO_URL\}\}/g, repoUrl)
      .replace(/\{\{OWNER\}\}/g, owner)
      .replace(/\{\{REPO\}\}/g, repo);
    await Bun.write(dest, content);
    copied.push(entry);
  }

  return copied;
}

async function copyWorkflowTemplates(target: string): Promise<{ copied: string[]; skipped: string[] }> {
  const workflowDir = join(target, ".github", "workflows");
  await ensureDir(workflowDir);

  const templatesDir = resolveTemplate("workflows");
  const fs = await import("fs/promises");

  let entries: string[];
  try {
    entries = (await fs.readdir(templatesDir)).filter((f) => f.endsWith(".yml"));
  } catch {
    return { copied: [], skipped: [] };
  }

  const copied: string[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const src = join(templatesDir, entry);
    const dest = join(workflowDir, entry);
    const destFile = Bun.file(dest);
    if (await destFile.exists()) {
      skipped.push(entry);
      continue;
    }
    const content = await Bun.file(src).text();
    await Bun.write(dest, content);
    copied.push(entry);
  }
  return { copied, skipped };
}

async function writePagesConfig(target: string): Promise<boolean> {
  const configPath = join(target, "_config.yml");
  const content = [
    "include:",
    "  - .bidme",
    "exclude:",
    "  - .bidme/config.toml",
    "  - .bidme/version.json",
    "  - .bidme/data",
    "  - .bidme/test",
    "",
  ].join("\n");

  return writeIfNotExists(configPath, content);
}

async function updateReadme(
  target: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  const readmePath = join(target, "README.md");
  const placeholder = bannerPlaceholder(owner, repo);
  const file = Bun.file(readmePath);

  if (await file.exists()) {
    const content = await file.text();
    if (content.includes(BANNER_START)) return false;
    await Bun.write(readmePath, placeholder + "\n\n" + content);
    return true;
  } else {
    await Bun.write(readmePath, placeholder + "\n");
    return true;
  }
}

export async function scaffold(
  target: string,
  config: BidMeConfig,
): Promise<ScaffoldResult> {
  const resolved = resolve(target);

  const bidmeDir = join(resolved, ".bidme");
  const dataDir = join(bidmeDir, "data");
  const archiveDir = join(dataDir, "archive");

  await ensureDir(archiveDir);
  const archiveCreated = await writeIfNotExists(join(archiveDir, ".gitkeep"), "");

  const toml = generateToml(config);
  const configCreated = await writeIfNotExists(join(bidmeDir, "config.toml"), toml);

  let pkgVersion = "0.2.0";
  try {
    const fromSource = resolve(import.meta.dir, "../../package.json");
    const pkgPath = existsSync(fromSource) ? fromSource : resolve(import.meta.dir, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    pkgVersion = pkg.version;
  } catch {}

  const versionJson = JSON.stringify(
    {
      version: pkgVersion,
      installed_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    },
    null,
    2,
  );
  const versionCreated = await writeIfNotExists(join(bidmeDir, "version.json"), versionJson);

  const { isGit, owner, repo } = await detectGitRepo(resolved);

  let workflowsCopied: string[] = [];
  let workflowsSkipped: string[] = [];
  if (isGit) {
    const result = await copyWorkflowTemplates(resolved);
    workflowsCopied = result.copied;
    workflowsSkipped = result.skipped;
  }

  const redirectCopied = await copyRedirectPage(resolved);
  const pagesConfigCreated = await writePagesConfig(resolved);
  const notFoundCopied = await copyNotFoundPage(resolved);
  const stripePagesCopied = await copyStripePages(resolved, owner, repo);
  const readmeUpdated = await updateReadme(resolved, owner, repo);

  return {
    configCreated,
    archiveCreated,
    dataFilesCreated: [],
    workflowsCopied,
    workflowsSkipped,
    redirectCopied,
    notFoundCopied,
    stripePagesCopied,
    pagesConfigCreated,
    readmeUpdated,
    versionCreated,
    owner,
    repo,
  };
}
