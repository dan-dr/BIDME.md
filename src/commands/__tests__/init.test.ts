import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, stat, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { DEFAULT_CONFIG, loadConfig, parseToml } from "../../lib/config.js";

describe("init end-to-end", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-init-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("--defaults creates config, archive dir, static pages, and no runtime data files", async () => {
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(await Bun.file(join(tempDir, ".bidme", "config.toml")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "version.json")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, "bidme", "redirect.html")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, "bidme", "stripe", "success.html")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "archive", ".gitkeep")).exists()).toBe(true);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "current-period.json")).exists()).toBe(false);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "analytics.json")).exists()).toBe(false);
    expect(await Bun.file(join(tempDir, ".bidme", "data", "bidders.json")).exists()).toBe(false);
    expect((await stat(join(tempDir, ".bidme", "data", "archive"))).isDirectory()).toBe(true);
    expect(result.dataFilesCreated).toEqual([]);
    expect(result.archiveCreated).toBe(true);
  });

  test("config.toml is valid and matches new spec defaults", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const parsed = parseToml(await Bun.file(join(tempDir, ".bidme", "config.toml")).text());

    expect(parsed.bidding.schedule).toBe("monthly");
    expect(parsed.banner.formats).toEqual(["png", "jpg", "svg", "webp"]);
    expect(parsed.approval.mode).toBe("emoji");
    expect(parsed.payment.mode).toBe("own_keys");
    expect(parsed.payment.bidme_fee_percent).toBe(10);
    expect(parsed.tracking.utm_params).toBe("utm_source=bidme&utm_campaign={owner}/{repo}");
  });

  test("README.md gets lower-case bidme markers and placeholder", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const readmeContent = await Bun.file(join(tempDir, "README.md")).text();
    expect(readmeContent).toContain("<!-- bidme-banner-start -->");
    expect(readmeContent).toContain("<!-- bidme-banner-end -->");
    expect(readmeContent).toContain("Your_Ad_Here");
  });

  test("running init twice doesn't duplicate markers or overwrite existing config", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);
    const firstToml = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();

    await scaffold(tempDir, {
      ...DEFAULT_CONFIG,
      bidding: { ...DEFAULT_CONFIG.bidding, minimum_bid: 999 },
    });

    expect(await Bun.file(join(tempDir, ".bidme", "config.toml")).text()).toBe(firstToml);
    const secondReadme = await Bun.file(join(tempDir, "README.md")).text();
    expect((secondReadme.match(/<!-- bidme-banner-start -->/g) || []).length).toBe(1);
    expect((secondReadme.match(/<!-- bidme-banner-end -->/g) || []).length).toBe(1);
  });

  test("scaffold + loadConfig round-trip reads config correctly", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);
    const config = await loadConfig(tempDir);
    expect(config.bidding).toEqual(DEFAULT_CONFIG.bidding);
    expect(config.banner).toEqual(DEFAULT_CONFIG.banner);
    expect(config.approval).toEqual(DEFAULT_CONFIG.approval);
    expect(config.payment.mode).toBe("own_keys");
  });

  test("workflow files are copied to .github/workflows/ when target is a git repo", async () => {
    await mkdir(join(tempDir, ".git"), { recursive: true });
    await Bun.write(
      join(tempDir, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/testowner/testrepo.git\n',
    );

    const result = await scaffold(tempDir, DEFAULT_CONFIG);
    const ymlFiles = (await readdir(join(tempDir, ".github", "workflows"))).filter((f) => f.endsWith(".yml")).sort();

    expect(ymlFiles).toEqual([
      "bidme-analytics.yml",
      "bidme-close.yml",
      "bidme-open.yml",
      "bidme-process-bid.yml",
    ]);
    expect(result.workflowsCopied.length).toBe(4);
    expect(await Bun.file(join(tempDir, "README.md")).text()).toContain("testowner/testrepo");
  });

  test("CLI init --defaults creates loadConfig-compatible config.toml", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "init", "--defaults", "--target", tempDir],
      { cwd: resolve(import.meta.dir, "../../.."), stdout: "pipe", stderr: "pipe" },
    );
    await proc.exited;
    expect(proc.exitCode).toBe(0);
    expect(await loadConfig(tempDir)).toEqual(DEFAULT_CONFIG);
  });
});
