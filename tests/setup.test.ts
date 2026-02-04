import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir, readdir } from "fs/promises";
import { tmpdir } from "os";
import { setup, type SetupResult } from "../scripts/setup.ts";

describe("setup", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-setup-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("creates bidme-config.yml from defaults when missing", async () => {
    const dir = resolve(tempDir, "fresh");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.configCreated).toBe(true);
    const configFile = Bun.file(resolve(dir, "bidme-config.yml"));
    expect(await configFile.exists()).toBe(true);
    const content = await configFile.text();
    expect(content).toContain('schedule: "monthly"');
    expect(content).toContain("minimum_bid: 50");
    expect(content).toContain("increment: 5");
  });

  test("does not overwrite existing bidme-config.yml", async () => {
    const dir = resolve(tempDir, "existing-config");
    await mkdir(dir, { recursive: true });
    await Bun.write(resolve(dir, "bidme-config.yml"), "bidding:\n  minimum_bid: 999\n");

    const result = await setup(dir);

    expect(result.configCreated).toBe(false);
    const content = await Bun.file(resolve(dir, "bidme-config.yml")).text();
    expect(content).toContain("minimum_bid: 999");
  });

  test("adds banner markers to existing README without them", async () => {
    const dir = resolve(tempDir, "readme-no-markers");
    await mkdir(dir, { recursive: true });
    await Bun.write(resolve(dir, "README.md"), "# My Repo\n\nSome content.\n");

    const result = await setup(dir);

    expect(result.readmeUpdated).toBe(true);
    const content = await Bun.file(resolve(dir, "README.md")).text();
    expect(content).toContain("<!-- BIDME:BANNER:START -->");
    expect(content).toContain("<!-- BIDME:BANNER:END -->");
    expect(content).toContain("# My Repo");
  });

  test("does not modify README that already has markers", async () => {
    const dir = resolve(tempDir, "readme-has-markers");
    await mkdir(dir, { recursive: true });
    const existing = "# My Repo\n\n<!-- BIDME:BANNER:START -->\n<!-- BIDME:BANNER:END -->\n\nContent.\n";
    await Bun.write(resolve(dir, "README.md"), existing);

    const result = await setup(dir);

    expect(result.readmeUpdated).toBe(false);
    const content = await Bun.file(resolve(dir, "README.md")).text();
    expect(content).toBe(existing);
  });

  test("creates README.md with markers when none exists", async () => {
    const dir = resolve(tempDir, "no-readme");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.readmeUpdated).toBe(true);
    const content = await Bun.file(resolve(dir, "README.md")).text();
    expect(content).toContain("<!-- BIDME:BANNER:START -->");
    expect(content).toContain("<!-- BIDME:BANNER:END -->");
  });

  test("creates data/ and data/archive/ directories", async () => {
    const dir = resolve(tempDir, "no-data");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.dataDirectoryCreated).toBe(true);
    const entries = await readdir(resolve(dir, "data"));
    expect(entries).toContain("archive");
  });

  test("handles existing data/ directory gracefully", async () => {
    const dir = resolve(tempDir, "has-data");
    await mkdir(resolve(dir, "data", "archive"), { recursive: true });
    await Bun.write(resolve(dir, "data", "current-period.json"), "{}");

    const result = await setup(dir);

    expect(result.dataDirectoryCreated).toBe(true);
    const periodFile = Bun.file(resolve(dir, "data", "current-period.json"));
    expect(await periodFile.exists()).toBe(true);
  });

  test("returns warnings about optional POLAR_ACCESS_TOKEN", async () => {
    const dir = resolve(tempDir, "warnings");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("POLAR_ACCESS_TOKEN"))).toBe(true);
  });

  test("prints summary with next steps", async () => {
    const dir = resolve(tempDir, "summary");
    await mkdir(dir, { recursive: true });

    const logs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      await setup(dir);
      const output = logs.join("\n");
      expect(output).toContain("Setup Summary");
      expect(output).toContain("Next Steps");
      expect(output).toContain("bidme-config.yml");
      expect(output).toContain("GitHub Actions");
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }
  });

  test("full setup on empty directory creates all files", async () => {
    const dir = resolve(tempDir, "full-empty");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.configCreated).toBe(true);
    expect(result.readmeUpdated).toBe(true);
    expect(result.dataDirectoryCreated).toBe(true);

    expect(await Bun.file(resolve(dir, "bidme-config.yml")).exists()).toBe(true);
    expect(await Bun.file(resolve(dir, "README.md")).exists()).toBe(true);
  });

  test("script runs via bun", async () => {
    const dir = resolve(tempDir, "bun-run");
    await mkdir(resolve(dir, "data"), { recursive: true });

    const proc = Bun.spawn(
      ["bun", "run", resolve(import.meta.dir, "../scripts/setup.ts")],
      {
        cwd: dir,
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain("BidMe: Setup");
    expect(output).toContain("Setup Summary");
  });

  test("detects non-git directory and sets isGitRepo to false", async () => {
    const dir = resolve(tempDir, "no-git");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.isGitRepo).toBe(false);
    expect(result.hasOriginRemote).toBe(false);
    expect(result.workflowsCopied).toEqual([]);
  });

  test("detects git repo without origin remote", async () => {
    const dir = resolve(tempDir, "git-no-origin");
    await mkdir(dir, { recursive: true });
    const proc = Bun.spawn(["git", "init"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    await proc.exited;

    const result = await setup(dir);

    expect(result.isGitRepo).toBe(true);
    expect(result.hasOriginRemote).toBe(false);
  });

  test("detects git repo with origin remote", async () => {
    const dir = resolve(tempDir, "git-with-origin");
    await mkdir(dir, { recursive: true });
    const init = Bun.spawn(["git", "init"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    await init.exited;
    const addRemote = Bun.spawn(
      ["git", "remote", "add", "origin", "https://github.com/test/test.git"],
      { cwd: dir, stdout: "pipe", stderr: "pipe" },
    );
    await addRemote.exited;

    const result = await setup(dir);

    expect(result.isGitRepo).toBe(true);
    expect(result.hasOriginRemote).toBe(true);
  });

  test("copies workflow files to .github/workflows/ in a git repo", async () => {
    const dir = resolve(tempDir, "git-workflows");
    await mkdir(dir, { recursive: true });
    const init = Bun.spawn(["git", "init"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    await init.exited;

    const result = await setup(dir);

    expect(result.isGitRepo).toBe(true);
    expect(result.workflowsCopied.length).toBeGreaterThan(0);

    const workflowDir = resolve(dir, ".github", "workflows");
    const files = await readdir(workflowDir);
    expect(files.length).toBeGreaterThan(0);

    for (const copied of result.workflowsCopied) {
      expect(await Bun.file(resolve(workflowDir, copied)).exists()).toBe(true);
    }
  });

  test("does not re-copy existing workflow files", async () => {
    const dir = resolve(tempDir, "git-existing-wf");
    await mkdir(dir, { recursive: true });
    const init = Bun.spawn(["git", "init"], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    await init.exited;

    const firstResult = await setup(dir);
    expect(firstResult.workflowsCopied.length).toBeGreaterThan(0);

    const secondResult = await setup(dir);
    expect(secondResult.workflowsCopied).toEqual([]);
  });

  test("creates empty analytics.json in data directory", async () => {
    const dir = resolve(tempDir, "analytics-file");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.dataFilesCreated).toContain("analytics.json");
    const content = await Bun.file(resolve(dir, "data", "analytics.json")).text();
    const parsed = JSON.parse(content);
    expect(parsed.periods).toEqual([]);
    expect(parsed.totals.revenue).toBe(0);
    expect(parsed.totals.bids).toBe(0);
    expect(parsed.totals.periods).toBe(0);
    expect(parsed.lastUpdated).toBeNull();
  });

  test("creates placeholder current-period.json in data directory", async () => {
    const dir = resolve(tempDir, "period-file");
    await mkdir(dir, { recursive: true });

    const result = await setup(dir);

    expect(result.dataFilesCreated).toContain("current-period.json");
    const content = await Bun.file(resolve(dir, "data", "current-period.json")).text();
    const parsed = JSON.parse(content);
    expect(parsed.status).toBe("inactive");
    expect(parsed.bids).toEqual([]);
    expect(parsed.createdAt).toBeNull();
    expect(parsed.closedAt).toBeNull();
  });

  test("does not overwrite existing analytics.json", async () => {
    const dir = resolve(tempDir, "existing-analytics");
    await mkdir(resolve(dir, "data"), { recursive: true });
    await Bun.write(resolve(dir, "data", "analytics.json"), '{"custom":true}');

    const result = await setup(dir);

    expect(result.dataFilesCreated).not.toContain("analytics.json");
    const content = await Bun.file(resolve(dir, "data", "analytics.json")).text();
    expect(JSON.parse(content).custom).toBe(true);
  });

  test("does not overwrite existing current-period.json", async () => {
    const dir = resolve(tempDir, "existing-period");
    await mkdir(resolve(dir, "data"), { recursive: true });
    await Bun.write(resolve(dir, "data", "current-period.json"), '{"status":"active"}');

    const result = await setup(dir);

    expect(result.dataFilesCreated).not.toContain("current-period.json");
    const content = await Bun.file(resolve(dir, "data", "current-period.json")).text();
    expect(JSON.parse(content).status).toBe("active");
  });

  test("summary includes git repo and workflow status", async () => {
    const dir = resolve(tempDir, "summary-git");
    await mkdir(dir, { recursive: true });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      await setup(dir);
      const output = logs.join("\n");
      expect(output).toContain("Git repo:");
      expect(output).toContain("Workflows:");
      expect(output).toContain("Data files:");
    } finally {
      console.log = origLog;
    }
  });

  test("non-git directory summary includes init step", async () => {
    const dir = resolve(tempDir, "summary-no-git");
    await mkdir(dir, { recursive: true });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      await setup(dir);
      const output = logs.join("\n");
      expect(output).toContain("git init");
    } finally {
      console.log = origLog;
    }
  });
});
