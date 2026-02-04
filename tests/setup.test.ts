import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir, readdir } from "fs/promises";
import { tmpdir } from "os";
import { setup, type SetupResult } from "../scripts/setup";

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
});
