import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, mkdir, stat } from "fs/promises";
import { tmpdir } from "os";
import {
  migrateConfig,
  migrateData,
  migrateWorkflows,
  migrateReadme,
  cleanupOldFiles,
} from "../migrations/v0.2.0.js";
import { migrations, getMigrationsAfter } from "../migrations/index.js";
import { parseToml } from "../config.js";
import { runUpdate } from "../../commands/update.js";

describe("v1→v2 config migration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-migrate-config-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("converts bidme-config.yml to .bidme/config.toml with correct values", async () => {
    const yaml = `bidding:
  schedule: weekly
  duration: 14
  minimum_bid: 100
  increment: 10
banner:
  width: 600
  height: 80
  format: "png,jpg"
  max_size: 150
content_guidelines:
  prohibited: ["gambling", "adult"]
  required: ["alt text"]
`;
    await Bun.write(join(tempDir, "bidme-config.yml"), yaml);

    const result = await migrateConfig(tempDir);
    expect(result).toBe(true);

    const tomlContent = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(tomlContent);

    expect(parsed.bidding.schedule).toBe("weekly");
    expect(parsed.bidding.duration).toBe(14);
    expect(parsed.bidding.minimum_bid).toBe(100);
    expect(parsed.bidding.increment).toBe(10);
    expect(parsed.banner.width).toBe(600);
    expect(parsed.banner.height).toBe(80);
    expect(parsed.banner.formats).toEqual(["png", "jpg"]);
    expect(parsed.banner.max_size).toBe(150);
    expect(parsed.content_guidelines.prohibited).toEqual(["gambling", "adult"]);
    expect(parsed.content_guidelines.required).toEqual(["alt text"]);
  });

  test("adds default sections (approval, payment, enforcement, tracking) to migrated config", async () => {
    const yaml = `bidding:
  schedule: monthly
  duration: 7
  minimum_bid: 50
  increment: 5
`;
    await Bun.write(join(tempDir, "bidme-config.yml"), yaml);

    await migrateConfig(tempDir);

    const tomlContent = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(tomlContent);

    expect(parsed.approval.mode).toBe("emoji");
    expect(parsed.payment.provider).toBe("polar-own");
    expect(parsed.enforcement.require_payment_before_bid).toBe(true);
    expect(parsed.tracking.append_utm).toBe(true);
  });

  test("banner.format string maps to banner.formats array (split on comma)", async () => {
    const yaml = `banner:
  format: "png,jpg,svg,gif"
`;
    await Bun.write(join(tempDir, "bidme-config.yml"), yaml);

    await migrateConfig(tempDir);

    const tomlContent = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(tomlContent);
    expect(parsed.banner.formats).toEqual(["png", "jpg", "svg", "gif"]);
  });

  test("returns false if no bidme-config.yml exists", async () => {
    const result = await migrateConfig(tempDir);
    expect(result).toBe(false);
  });

  test("skips if .bidme/config.toml already exists (idempotent)", async () => {
    await Bun.write(join(tempDir, "bidme-config.yml"), "bidding:\n  schedule: weekly\n");
    await mkdir(join(tempDir, ".bidme"), { recursive: true });
    await Bun.write(join(tempDir, ".bidme", "config.toml"), "# existing config");

    const result = await migrateConfig(tempDir);
    expect(result).toBe(false);

    const content = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    expect(content).toBe("# existing config");
  });
});

describe("v1→v2 data migration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-migrate-data-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("moves files from data/ to .bidme/data/", async () => {
    await mkdir(join(tempDir, "data", "archive"), { recursive: true });
    await Bun.write(join(tempDir, "data", "current-period.json"), '{"period": null}');
    await Bun.write(join(tempDir, "data", "analytics.json"), '{"periods": []}');
    await Bun.write(join(tempDir, "data", "archive", "period-2025-01-01.json"), '{"archived": true}');

    const result = await migrateData(tempDir);
    expect(result).toBe(true);

    expect(await Bun.file(join(tempDir, ".bidme", "data", "current-period.json")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "analytics.json")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "archive", "period-2025-01-01.json")).exists()).toBe(true);

    const archive = await Bun.file(join(tempDir, ".bidme", "data", "archive", "period-2025-01-01.json")).text();
    expect(archive).toBe('{"archived": true}');
  });

  test("adds missing bids and status fields to current-period.json during migration", async () => {
    await mkdir(join(tempDir, "data"), { recursive: true });
    await Bun.write(join(tempDir, "data", "current-period.json"), '{"period": null}');

    await migrateData(tempDir);

    const content = await Bun.file(join(tempDir, ".bidme", "data", "current-period.json")).text();
    const data = JSON.parse(content);
    expect(data.period).toBe(null);
    expect(data.bids).toEqual([]);
    expect(data.status).toBe("inactive");
  });

  test("adds missing total_revenue and total_bids to analytics.json during migration", async () => {
    await mkdir(join(tempDir, "data"), { recursive: true });
    await Bun.write(join(tempDir, "data", "analytics.json"), '{"periods": []}');

    await migrateData(tempDir);

    const content = await Bun.file(join(tempDir, ".bidme", "data", "analytics.json")).text();
    const data = JSON.parse(content);
    expect(data.periods).toEqual([]);
    expect(data.total_revenue).toBe(0);
    expect(data.total_bids).toBe(0);
  });

  test("returns false if no data/ directory exists", async () => {
    const result = await migrateData(tempDir);
    expect(result).toBe(false);
  });

  test("does not overwrite existing files in .bidme/data/ (idempotent)", async () => {
    await mkdir(join(tempDir, "data"), { recursive: true });
    await Bun.write(join(tempDir, "data", "analytics.json"), '{"old": true}');
    await mkdir(join(tempDir, ".bidme", "data"), { recursive: true });
    await Bun.write(join(tempDir, ".bidme", "data", "analytics.json"), '{"new": true}');

    await migrateData(tempDir);

    const content = await Bun.file(join(tempDir, ".bidme", "data", "analytics.json")).text();
    expect(content).toBe('{"new": true}');
  });
});

describe("v1→v2 workflow migration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-migrate-workflows-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("renames old workflow files to new names", async () => {
    const workflowDir = join(tempDir, ".github", "workflows");
    await mkdir(workflowDir, { recursive: true });

    await Bun.write(join(workflowDir, "schedule-bidding.yml"), "name: schedule");
    await Bun.write(join(workflowDir, "process-bid.yml"), "name: process-bid");
    await Bun.write(join(workflowDir, "close-bidding.yml"), "name: close");

    const migrated = await migrateWorkflows(tempDir);

    expect(migrated.length).toBe(3);
    expect(migrated).toContain("schedule-bidding.yml → bidme-schedule.yml");
    expect(migrated).toContain("process-bid.yml → bidme-process-bid.yml");
    expect(migrated).toContain("close-bidding.yml → bidme-close-bidding.yml");

    expect(await Bun.file(join(workflowDir, "schedule-bidding.yml")).exists()).toBe(false);
    expect(await Bun.file(join(workflowDir, "process-bid.yml")).exists()).toBe(false);
    expect(await Bun.file(join(workflowDir, "close-bidding.yml")).exists()).toBe(false);

    expect(await Bun.file(join(workflowDir, "bidme-schedule.yml")).exists()).toBe(true);
    expect(await Bun.file(join(workflowDir, "bidme-process-bid.yml")).exists()).toBe(true);
    expect(await Bun.file(join(workflowDir, "bidme-close-bidding.yml")).exists()).toBe(true);
  });

  test("returns empty array if no workflows directory exists", async () => {
    const result = await migrateWorkflows(tempDir);
    expect(result).toEqual([]);
  });

  test("returns empty array if no old workflow files exist", async () => {
    const workflowDir = join(tempDir, ".github", "workflows");
    await mkdir(workflowDir, { recursive: true });

    const result = await migrateWorkflows(tempDir);
    expect(result).toEqual([]);
  });
});

describe("v1→v2 readme migration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-migrate-readme-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("updates old banner markers to v2 format", async () => {
    const oldReadme = `# My Project

<!-- BIDME:BANNER:START -->
Old banner content for https://github.com/testowner/testrepo
<!-- BIDME:BANNER:END -->

Some content below.
`;
    await Bun.write(join(tempDir, "README.md"), oldReadme);

    const result = await migrateReadme(tempDir);
    expect(result).toBe(true);

    const updated = await Bun.file(join(tempDir, "README.md")).text();
    expect(updated).toContain("<!-- BIDME:BANNER:START -->");
    expect(updated).toContain("<!-- BIDME:BANNER:END -->");
    expect(updated).toContain("[![Sponsored via BidMe]");
    expect(updated).toContain("testowner/testrepo");
    expect(updated).toContain("Some content below.");
    expect(updated).not.toContain("Old banner content");
  });

  test("returns false if no README.md exists", async () => {
    const result = await migrateReadme(tempDir);
    expect(result).toBe(false);
  });

  test("returns false if no banner markers exist", async () => {
    await Bun.write(join(tempDir, "README.md"), "# No banner here\n");
    const result = await migrateReadme(tempDir);
    expect(result).toBe(false);
  });

  test("is idempotent - returns false when already in v2 format", async () => {
    const issueUrl = "https://github.com/owner/repo/issues?q=label%3Abidme";
    const v2Readme = `<!-- BIDME:BANNER:START -->
[![Sponsored via BidMe](https://img.shields.io/badge/Sponsored%20via-BidMe-blue)](${issueUrl})

[Sponsored via BidMe](${issueUrl})
<!-- BIDME:BANNER:END -->
`;
    await Bun.write(join(tempDir, "README.md"), v2Readme);

    const result = await migrateReadme(tempDir);
    expect(result).toBe(false);

    const content = await Bun.file(join(tempDir, "README.md")).text();
    expect(content).toBe(v2Readme);
  });

  test("preserves content before and after banner markers", async () => {
    const readme = `# Title

Some intro text.

<!-- BIDME:BANNER:START -->
Legacy banner for https://github.com/myorg/myrepo
<!-- BIDME:BANNER:END -->

## More content

Details here.
`;
    await Bun.write(join(tempDir, "README.md"), readme);

    await migrateReadme(tempDir);

    const updated = await Bun.file(join(tempDir, "README.md")).text();
    expect(updated).toContain("# Title");
    expect(updated).toContain("Some intro text.");
    expect(updated).toContain("## More content");
    expect(updated).toContain("Details here.");
    expect(updated).toContain("myorg/myrepo");
  });
});

describe("cleanup old files", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-cleanup-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("deletes bidme-config.yml and data/ directory", async () => {
    await Bun.write(join(tempDir, "bidme-config.yml"), "old config");
    await mkdir(join(tempDir, "data"), { recursive: true });
    await Bun.write(join(tempDir, "data", "test.json"), "{}");

    const deleted = await cleanupOldFiles(tempDir);

    expect(deleted).toContain("bidme-config.yml");
    expect(deleted).toContain("data/");
    expect(await Bun.file(join(tempDir, "bidme-config.yml")).exists()).toBe(false);

    let dataExists = false;
    try {
      await stat(join(tempDir, "data"));
      dataExists = true;
    } catch {
      dataExists = false;
    }
    expect(dataExists).toBe(false);
  });
});

describe("migration is idempotent", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-idempotent-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("running full v0.2.0 migration twice does not break anything", async () => {
    await mkdir(join(tempDir, "data", "archive"), { recursive: true });
    await Bun.write(join(tempDir, "bidme-config.yml"), "bidding:\n  schedule: monthly\n  duration: 7\n");
    await Bun.write(join(tempDir, "data", "analytics.json"), '{"periods": []}');

    const migration = migrations.find((m) => m.version === "0.2.0");
    expect(migration).toBeDefined();

    await migration!.migrate(tempDir);

    expect(await Bun.file(join(tempDir, ".bidme", "config.toml")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "version.json")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "analytics.json")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, "bidme-config.yml")).exists()).toBe(false);

    const firstToml = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();

    await migration!.migrate(tempDir);

    const secondToml = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    expect(secondToml).toBe(firstToml);
  });
});

describe("update command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-update-cmd-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("reports 'already up to date' when versions match", async () => {
    await mkdir(join(tempDir, ".bidme"), { recursive: true });

    const pkgPath = resolve(import.meta.dir, "../../../package.json");
    const pkg = JSON.parse(await Bun.file(pkgPath).text());

    await Bun.write(
      join(tempDir, ".bidme", "version.json"),
      JSON.stringify({
        version: pkg.version,
        installed_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );

    const result = await runUpdate({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(true);
    expect(result.migrationsRun).toEqual([]);
  });

  test("detects legacy v1 install and runs migration", async () => {
    await mkdir(join(tempDir, "data"), { recursive: true });
    await Bun.write(join(tempDir, "bidme-config.yml"), "bidding:\n  schedule: monthly\n");
    await Bun.write(join(tempDir, "data", "analytics.json"), '{"periods": []}');

    const result = await runUpdate({ target: tempDir });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(false);
    expect(result.migrationsRun).toContain("0.2.0");

    expect(await Bun.file(join(tempDir, ".bidme", "config.toml")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "version.json")).exists()).toBe(true);
  });

  test("fails if no installation found", async () => {
    const result = await runUpdate({ target: tempDir });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("migration framework", () => {
  test("migrations are sorted by version", () => {
    for (let i = 1; i < migrations.length; i++) {
      const cmp = migrations[i - 1]!.version.localeCompare(migrations[i]!.version, undefined, {
        numeric: true,
      });
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  test("getMigrationsAfter filters correctly", () => {
    const after = getMigrationsAfter("0.1.0");
    expect(after.length).toBeGreaterThanOrEqual(1);
    expect(after.some((m) => m.version === "0.2.0")).toBe(true);

    const afterCurrent = getMigrationsAfter("0.2.0");
    expect(afterCurrent.length).toBe(0);

    const afterFuture = getMigrationsAfter("99.0.0");
    expect(afterFuture.length).toBe(0);
  });
});
