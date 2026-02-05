import { join, resolve } from "path";
import { type Migration } from "./index.js";
import { DEFAULT_CONFIG, generateToml, type BidMeConfig } from "../config.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    const f = Bun.file(path);
    return await f.exists();
  } catch {
    return false;
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(dirPath, { recursive: true });
}

export async function migrateConfig(targetDir: string): Promise<boolean> {
  const oldConfigPath = join(targetDir, "bidme-config.yml");
  const newConfigPath = join(targetDir, ".bidme", "config.toml");

  if (!(await fileExists(oldConfigPath))) return false;
  if (await fileExists(newConfigPath)) return false;

  await ensureDir(join(targetDir, ".bidme"));

  const yamlContent = await Bun.file(oldConfigPath).text();
  const parsed = parseSimpleYaml(yamlContent);

  const config: BidMeConfig = { ...DEFAULT_CONFIG };

  if (parsed.bidding) {
    if (parsed.bidding.schedule) config.bidding.schedule = parsed.bidding.schedule;
    if (parsed.bidding.duration) config.bidding.duration = Number(parsed.bidding.duration);
    if (parsed.bidding.minimum_bid) config.bidding.minimum_bid = Number(parsed.bidding.minimum_bid);
    if (parsed.bidding.increment) config.bidding.increment = Number(parsed.bidding.increment);
  }

  if (parsed.banner) {
    if (parsed.banner.width) config.banner.width = Number(parsed.banner.width);
    if (parsed.banner.height) config.banner.height = Number(parsed.banner.height);
    if (parsed.banner.max_size) config.banner.max_size = Number(parsed.banner.max_size);
    if (typeof parsed.banner.format === "string") {
      config.banner.formats = parsed.banner.format.split(",").map((s: string) => s.trim());
    } else if (parsed.banner.formats) {
      config.banner.formats = parsed.banner.formats;
    }
  }

  if (parsed.content_guidelines) {
    if (parsed.content_guidelines.prohibited) {
      config.content_guidelines.prohibited = parsed.content_guidelines.prohibited;
    }
    if (parsed.content_guidelines.required) {
      config.content_guidelines.required = parsed.content_guidelines.required;
    }
  }

  if (parsed.analytics) {
    config.tracking.append_utm = parsed.analytics.track_clicks !== false;
  }

  const toml = generateToml(config);
  await Bun.write(newConfigPath, toml);
  return true;
}

export async function migrateData(targetDir: string): Promise<boolean> {
  const oldDataDir = join(targetDir, "data");
  const newDataDir = join(targetDir, ".bidme", "data");

  const fs = await import("fs/promises");

  let oldExists = false;
  try {
    const stat = await fs.stat(oldDataDir);
    oldExists = stat.isDirectory();
  } catch {
    oldExists = false;
  }

  if (!oldExists) return false;

  await ensureDir(join(newDataDir, "archive"));

  const filesToMigrate = ["current-period.json", "analytics.json", "bidders.json"];
  let migrated = false;

  for (const file of filesToMigrate) {
    const src = join(oldDataDir, file);
    const dest = join(newDataDir, file);
    if ((await fileExists(src)) && !(await fileExists(dest))) {
      let content = await Bun.file(src).text();
      if (file === "current-period.json") {
        try {
          const data = JSON.parse(content);
          if (!("bids" in data)) data.bids = [];
          if (!("status" in data)) data.status = "inactive";
          content = JSON.stringify(data, null, 2);
        } catch {}
      }
      if (file === "analytics.json") {
        try {
          const data = JSON.parse(content);
          if (!("total_revenue" in data)) data.total_revenue = 0;
          if (!("total_bids" in data)) data.total_bids = 0;
          content = JSON.stringify(data, null, 2);
        } catch {}
      }
      await Bun.write(dest, content);
      migrated = true;
    }
  }

  const archiveSrc = join(oldDataDir, "archive");
  let archiveExists = false;
  try {
    const stat = await fs.stat(archiveSrc);
    archiveExists = stat.isDirectory();
  } catch {
    archiveExists = false;
  }

  if (archiveExists) {
    const archiveFiles = await fs.readdir(archiveSrc);
    for (const file of archiveFiles) {
      const src = join(archiveSrc, file);
      const dest = join(newDataDir, "archive", file);
      if (!(await fileExists(dest))) {
        const content = await Bun.file(src).text();
        await Bun.write(dest, content);
        migrated = true;
      }
    }
  }

  return migrated;
}

const WORKFLOW_RENAMES: Record<string, string> = {
  "schedule-bidding.yml": "bidme-schedule.yml",
  "process-bid.yml": "bidme-process-bid.yml",
  "process-approval.yml": "bidme-process-approval.yml",
  "close-bidding.yml": "bidme-close-bidding.yml",
  "update-analytics.yml": "bidme-analytics.yml",
};

export async function migrateWorkflows(targetDir: string): Promise<string[]> {
  const workflowDir = join(targetDir, ".github", "workflows");
  const fs = await import("fs/promises");
  const templatesDir = resolve(import.meta.dir, "../../../templates/workflows");

  let dirExists = false;
  try {
    const stat = await fs.stat(workflowDir);
    dirExists = stat.isDirectory();
  } catch {
    dirExists = false;
  }

  if (!dirExists) return [];

  const migrated: string[] = [];

  for (const [oldName, newName] of Object.entries(WORKFLOW_RENAMES)) {
    const oldPath = join(workflowDir, oldName);
    const newPath = join(workflowDir, newName);

    if (await fileExists(oldPath)) {
      let templateContent: string | null = null;
      try {
        templateContent = await Bun.file(join(templatesDir, newName)).text();
      } catch {
        templateContent = null;
      }

      if (templateContent) {
        await Bun.write(newPath, templateContent);
      } else {
        const oldContent = await Bun.file(oldPath).text();
        const updated = oldContent
          .replace(/bun run scripts\//g, "bun x bidme ")
          .replace(/bunx bidme-/g, "bun x bidme ");
        await Bun.write(newPath, updated);
      }

      await fs.unlink(oldPath);
      migrated.push(`${oldName} → ${newName}`);
    }
  }

  return migrated;
}

export async function migrateReadme(targetDir: string): Promise<boolean> {
  const readmePath = join(targetDir, "README.md");
  if (!(await fileExists(readmePath))) return false;

  const content = await Bun.file(readmePath).text();
  const BANNER_START = "<!-- BIDME:BANNER:START -->";
  const BANNER_END = "<!-- BIDME:BANNER:END -->";

  if (!content.includes(BANNER_START)) return false;

  const startIdx = content.indexOf(BANNER_START);
  const endIdx = content.indexOf(BANNER_END);
  if (endIdx === -1 || endIdx < startIdx) return false;

  const afterEnd = endIdx + BANNER_END.length;
  const existingBlock = content.slice(startIdx, afterEnd);

  let owner = "OWNER";
  let repo = "REPO";
  const repoMatch = existingBlock.match(/github\.com\/([^/\s]+)\/([^/\s)]+)/);
  if (repoMatch && repoMatch[1] && repoMatch[2]) {
    owner = repoMatch[1];
    repo = repoMatch[2].replace(/\?.*$/, "");
  }

  const issueUrl = `https://github.com/${owner}/${repo}/issues?q=label%3Abidme`;
  const v2Block = [
    BANNER_START,
    `[![Sponsored via BidMe](https://img.shields.io/badge/Sponsored%20via-BidMe-blue)](${issueUrl})`,
    "",
    `[Sponsored via BidMe](${issueUrl})`,
    BANNER_END,
  ].join("\n");

  if (existingBlock === v2Block) return false;

  const updated = content.slice(0, startIdx) + v2Block + content.slice(afterEnd);
  await Bun.write(readmePath, updated);
  return true;
}

export async function cleanupOldFiles(targetDir: string): Promise<string[]> {
  const fs = await import("fs/promises");
  const deleted: string[] = [];

  const oldConfigPath = join(targetDir, "bidme-config.yml");
  if (await fileExists(oldConfigPath)) {
    await fs.unlink(oldConfigPath);
    deleted.push("bidme-config.yml");
  }

  const oldDataDir = join(targetDir, "data");
  let dataExists = false;
  try {
    const stat = await fs.stat(oldDataDir);
    dataExists = stat.isDirectory();
  } catch {
    dataExists = false;
  }

  if (dataExists) {
    await fs.rm(oldDataDir, { recursive: true });
    deleted.push("data/");
  }

  return deleted;
}

function parseSimpleYaml(yamlStr: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection = "";

  for (const line of yamlStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;

    if (indent === 0 && trimmed.endsWith(":")) {
      currentSection = trimmed.slice(0, -1);
      result[currentSection] = {};
      continue;
    }

    if (indent === 0 && trimmed.includes(":")) {
      const parts = trimmed.split(":");
      const key = parts[0];
      const value = parts.slice(1).join(":").trim();
      if (key) result[key.trim()] = parseYamlValue(value);
      continue;
    }

    if (currentSection && trimmed.includes(":")) {
      const parts = trimmed.split(":");
      const key = parts[0];
      const value = parts.slice(1).join(":").trim();
      if (key) result[currentSection][key.trim()] = parseYamlValue(value);
    }
  }

  return result;
}

function parseYamlValue(value: string): any {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "") return null;

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1);
    return inner.split(",").map((s) => {
      const t = s.trim();
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
      }
      return t;
    });
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;

  return value;
}

export const v020Migration: Migration = {
  version: "0.2.0",
  description: "Migrate from v1 (legacy) to v2: config, data, workflows",
  migrate: async (targetDir: string) => {
    await migrateConfig(targetDir);
    await migrateData(targetDir);
    await migrateWorkflows(targetDir);
    await migrateReadme(targetDir);
    await cleanupOldFiles(targetDir);

    const versionPath = join(targetDir, ".bidme", "version.json");
    await ensureDir(join(targetDir, ".bidme"));
    await Bun.write(
      versionPath,
      JSON.stringify(
        {
          version: "0.2.0",
          installed_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  },
};
