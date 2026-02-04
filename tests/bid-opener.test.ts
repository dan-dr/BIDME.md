import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { resolve } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";

describe("bid-opener", () => {
  let tempDir: string;
  let dataDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-opener-"));
    dataDir = resolve(tempDir, "data");
    await mkdir(dataDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("openBiddingPeriod loads config and creates period data", async () => {
    const configPath = resolve(tempDir, "bidme-config.yml");
    await Bun.write(
      configPath,
      `bidding:\n  schedule: "weekly"\n  duration: 5\n  minimum_bid: 100\n  increment: 10\nbanner:\n  width: 800\n  height: 100\n  format: "png,jpg"\n  max_size: 200\n  position: "top"\n`,
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const { openBiddingPeriod } = await import("../scripts/bid-opener");
      await openBiddingPeriod(configPath);

      const periodFile = Bun.file(resolve(dataDir, "current-period.json"));
      expect(await periodFile.exists()).toBe(true);

      const periodData = JSON.parse(await periodFile.text());
      expect(periodData.status).toBe("open");
      expect(periodData.bids).toEqual([]);
      expect(periodData.issue_number).toBe(0);
      expect(periodData.period_id).toMatch(/^period-\d{4}-\d{2}-\d{2}$/);

      const start = new Date(periodData.start_date);
      const end = new Date(periodData.end_date);
      const diffDays = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(5);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("script runs via bun and shows intent without GITHUB_TOKEN", async () => {
    const configPath = resolve(tempDir, "bidme-config2.yml");
    await Bun.write(
      configPath,
      `bidding:\n  schedule: "monthly"\n  duration: 7\n  minimum_bid: 50\n  increment: 5\n`,
    );

    const dataDir2 = resolve(tempDir, "data2", "data");
    await mkdir(dataDir2, { recursive: true });

    const proc = Bun.spawn(
      [
        "bun",
        "run",
        resolve(import.meta.dir, "../scripts/bid-opener.ts"),
      ],
      {
        cwd: resolve(tempDir, "data2"),
        env: {
          ...process.env,
          GITHUB_TOKEN: undefined,
          GITHUB_REPOSITORY_OWNER: undefined,
          GITHUB_REPOSITORY: undefined,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(output).toContain("BidMe: Opening New Bidding Period");
    expect(output).toContain("Config loaded");
  });

  test("period data has correct structure", async () => {
    const configPath = resolve(tempDir, "bidme-config3.yml");
    await Bun.write(
      configPath,
      `bidding:\n  duration: 14\n`,
    );

    const dataDir3 = resolve(tempDir, "data3", "data");
    await mkdir(dataDir3, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(resolve(tempDir, "data3"));

    try {
      const mod = await import("../scripts/bid-opener");
      await mod.openBiddingPeriod(configPath);

      const periodFile = Bun.file(resolve(dataDir3, "current-period.json"));
      const periodData = JSON.parse(await periodFile.text());

      expect(periodData).toHaveProperty("period_id");
      expect(periodData).toHaveProperty("start_date");
      expect(periodData).toHaveProperty("end_date");
      expect(periodData).toHaveProperty("issue_number");
      expect(periodData).toHaveProperty("issue_node_id");
      expect(periodData).toHaveProperty("status");
      expect(periodData).toHaveProperty("bids");
      expect(periodData.issue_node_id).toBe("");
      expect(periodData.status).toBe("open");
      expect(Array.isArray(periodData.bids)).toBe(true);

      const start = new Date(periodData.start_date);
      const end = new Date(periodData.end_date);
      const diffDays = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("generateIssueBody via bid-opener includes all required sections", async () => {
    const configPath = resolve(tempDir, "bidme-config4.yml");
    await Bun.write(
      configPath,
      `bidding:\n  minimum_bid: 75\n  increment: 25\nbanner:\n  width: 600\n  height: 120\n  format: "png,svg"\n  max_size: 150\n`,
    );

    const dataDir4 = resolve(tempDir, "data4", "data");
    await mkdir(dataDir4, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(resolve(tempDir, "data4"));

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      const mod = await import("../scripts/bid-opener");
      await mod.openBiddingPeriod(configPath);

      const output = logs.join("\n");
      expect(output).toContain("Minimum bid: $75");
      expect(output).toContain("Would create issue:");
      expect(output).toContain("BidMe: Banner Bidding");
    } finally {
      console.log = origLog;
      process.chdir(originalCwd);
    }
  });
});
