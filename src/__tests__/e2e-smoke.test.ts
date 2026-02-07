import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, stat, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { parseToml } from "../lib/config.js";
import { runUpdate } from "../commands/update.js";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function runCli(args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: cwd ?? PROJECT_ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GITHUB_REPOSITORY_OWNER: "", GITHUB_REPOSITORY: "" },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

describe("full end-to-end smoke test", () => {
  let e2eDir: string;

  beforeEach(async () => {
    e2eDir = await mkdtemp(resolve(tmpdir(), "bidme-e2e-"));
    // Initialize a git repo so workflows get copied
    const initProc = Bun.spawn(["git", "init"], { cwd: e2eDir, stdout: "pipe", stderr: "pipe" });
    await initProc.exited;
    // Create an initial commit
    const commitProc = Bun.spawn(
      ["git", "commit", "--allow-empty", "-m", "init"],
      { cwd: e2eDir, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@test.com" } },
    );
    await commitProc.exited;
  });

  afterEach(async () => {
    await rm(e2eDir, { recursive: true });
  });

  test("init --defaults creates all expected files", async () => {
    const { exitCode } = await runCli(["init", "--defaults", "--target", e2eDir]);
    expect(exitCode).toBe(0);

    // .bidme/config.toml
    expect(await fileExists(join(e2eDir, ".bidme", "config.toml"))).toBe(true);

    // .bidme/version.json
    expect(await fileExists(join(e2eDir, ".bidme", "version.json"))).toBe(true);

    // .bidme/data files
    expect(await fileExists(join(e2eDir, ".bidme", "data", "current-period.json"))).toBe(true);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "analytics.json"))).toBe(true);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "bidders.json"))).toBe(true);
    expect(await dirExists(join(e2eDir, ".bidme", "data", "archive"))).toBe(true);

    // .bidme/redirect.html
    expect(await fileExists(join(e2eDir, ".bidme", "redirect.html"))).toBe(true);

    // README.md with banner placeholder
    expect(await fileExists(join(e2eDir, "README.md"))).toBe(true);
    const readme = await Bun.file(join(e2eDir, "README.md")).text();
    expect(readme).toContain("<!-- BIDME:BANNER:START -->");
    expect(readme).toContain("<!-- BIDME:BANNER:END -->");
    expect(readme).toContain("Sponsored via BidMe");

    // .github/workflows/bidme-*.yml
    const workflowDir = join(e2eDir, ".github", "workflows");
    expect(await dirExists(workflowDir)).toBe(true);
    const workflows = await readdir(workflowDir);
    const bidmeWorkflows = workflows.filter((f) => f.startsWith("bidme-") && f.endsWith(".yml"));
    expect(bidmeWorkflows).toContain("bidme-schedule.yml");
    expect(bidmeWorkflows).toContain("bidme-process-bid.yml");
    expect(bidmeWorkflows).toContain("bidme-process-approval.yml");
    expect(bidmeWorkflows).toContain("bidme-close-bidding.yml");
    expect(bidmeWorkflows).toContain("bidme-check-grace.yml");
    expect(bidmeWorkflows).toContain("bidme-analytics.yml");
    expect(bidmeWorkflows).toContain("bidme-daily-recap.yml");
    expect(bidmeWorkflows.length).toBe(7);
  });

  test("config.toml parses correctly with @iarna/toml", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const tomlContent = await Bun.file(join(e2eDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(tomlContent);

    expect(parsed.bidding.schedule).toBe("monthly");
    expect(parsed.bidding.duration).toBe(7);
    expect(parsed.bidding.minimum_bid).toBe(50);
    expect(parsed.bidding.increment).toBe(5);
    expect(parsed.banner.width).toBe(800);
    expect(parsed.banner.height).toBe(100);
    expect(parsed.banner.formats).toEqual(["png", "jpg", "svg"]);
    expect(parsed.banner.max_size).toBe(200);
    expect(parsed.approval.mode).toBe("emoji");
    expect(parsed.payment.provider).toBe("stripe");
    expect(parsed.enforcement.require_payment_before_bid).toBe(true);
    expect(parsed.tracking.append_utm).toBe(true);
    expect(parsed.content_guidelines.prohibited).toEqual(["adult content", "gambling", "misleading claims"]);
  });

  test("version.json contains correct version", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const versionContent = await Bun.file(join(e2eDir, ".bidme", "version.json")).text();
    const version = JSON.parse(versionContent);

    const pkg = JSON.parse(await Bun.file(join(PROJECT_ROOT, "package.json")).text());
    expect(version.version).toBe(pkg.version);
    expect(version.installed_at).toBeDefined();
    expect(version.last_updated).toBeDefined();
  });

  test("open-bidding fails gracefully without GitHub environment", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const { exitCode, stdout } = await runCli(["open-bidding", "--target", e2eDir]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("GitHub environment not configured");
  });

  test("open-bidding saves period stub data locally", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);
    await runCli(["open-bidding", "--target", e2eDir]);

    const periodContent = await Bun.file(join(e2eDir, ".bidme", "data", "current-period.json")).text();
    const period = JSON.parse(periodContent);

    expect(period.status).toBe("open");
    expect(period.period_id).toMatch(/^period-\d{4}-\d{2}-\d{2}$/);
    expect(period.start_date).toBeDefined();
    expect(period.end_date).toBeDefined();
    expect(period.bids).toEqual([]);
  });

  test("v1→v2 migration: converts legacy project to v2 format", async () => {
    // Set up a v1 file layout
    const v1Dir = await mkdtemp(resolve(tmpdir(), "bidme-v1-test-"));
    try {
      // v1 config file
      const v1Config = `bidding:
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
      await Bun.write(join(v1Dir, "bidme-config.yml"), v1Config);

      // v1 data directory
      await mkdir(join(v1Dir, "data", "archive"), { recursive: true });
      await Bun.write(
        join(v1Dir, "data", "current-period.json"),
        JSON.stringify({ period: null }),
      );
      await Bun.write(
        join(v1Dir, "data", "analytics.json"),
        JSON.stringify({ periods: [] }),
      );
      await Bun.write(
        join(v1Dir, "data", "archive", "period-2025-01-01.json"),
        JSON.stringify({ archived: true }),
      );

      // Run update (migration)
      const result = await runUpdate({ target: v1Dir });

      expect(result.success).toBe(true);
      expect(result.alreadyUpToDate).toBe(false);
      expect(result.migrationsRun).toContain("0.2.0");

      // Verify v2 files created
      expect(await fileExists(join(v1Dir, ".bidme", "config.toml"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "version.json"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "data", "analytics.json"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "data", "current-period.json"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "data", "archive", "period-2025-01-01.json"))).toBe(true);

      // Verify config was migrated correctly
      const toml = await Bun.file(join(v1Dir, ".bidme", "config.toml")).text();
      const parsed = parseToml(toml);
      expect(parsed.bidding.schedule).toBe("weekly");
      expect(parsed.bidding.duration).toBe(14);
      expect(parsed.bidding.minimum_bid).toBe(100);
      expect(parsed.banner.formats).toEqual(["png", "jpg"]);

      // Verify old files cleaned up
      expect(await fileExists(join(v1Dir, "bidme-config.yml"))).toBe(false);
      expect(await dirExists(join(v1Dir, "data"))).toBe(false);

      // Verify data schema normalization
      const periodJson = JSON.parse(
        await Bun.file(join(v1Dir, ".bidme", "data", "current-period.json")).text(),
      );
      expect(periodJson.bids).toEqual([]);
      expect(periodJson.status).toBe("inactive");

      const analyticsJson = JSON.parse(
        await Bun.file(join(v1Dir, ".bidme", "data", "analytics.json")).text(),
      );
      expect(analyticsJson.total_revenue).toBe(0);
      expect(analyticsJson.total_bids).toBe(0);
    } finally {
      await rm(v1Dir, { recursive: true });
    }
  });

  test("update reports 'already up to date' after fresh init", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const result = await runUpdate({ target: e2eDir });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(true);
    expect(result.migrationsRun).toEqual([]);
  });

  test("data files contain valid JSON with expected schema", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const period = JSON.parse(
      await Bun.file(join(e2eDir, ".bidme", "data", "current-period.json")).text(),
    );
    expect(period.period).toBe(null);
    expect(period.bids).toEqual([]);
    expect(period.status).toBe("inactive");

    const analytics = JSON.parse(
      await Bun.file(join(e2eDir, ".bidme", "data", "analytics.json")).text(),
    );
    expect(analytics.periods).toEqual([]);
    expect(analytics.total_revenue).toBe(0);
    expect(analytics.total_bids).toBe(0);

    const bidders = JSON.parse(
      await Bun.file(join(e2eDir, ".bidme", "data", "bidders.json")).text(),
    );
    expect(bidders.bidders).toEqual({});
  });

  test("workflow files have non-empty content", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const workflowDir = join(e2eDir, ".github", "workflows");
    const workflows = (await readdir(workflowDir)).filter((f) => f.endsWith(".yml"));

    for (const wf of workflows) {
      const content = await Bun.file(join(workflowDir, wf)).text();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("name:");
    }
  });

  test("close-bidding processes Stripe payment flow with winner", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    // Create bidders.json with Stripe customer info
    const biddersData = {
      bidders: {
        "test-bidder": {
          github_username: "test-bidder",
          registered_at: new Date().toISOString(),
          payment_linked: true,
          stripe_customer_id: "cus_test123",
          stripe_payment_method_id: "pm_test456",
        },
      },
    };
    await Bun.write(
      join(e2eDir, ".bidme", "data", "bidders.json"),
      JSON.stringify(biddersData, null, 2),
    );

    // Create an open period with a winning bid
    const periodData = {
      period_id: "period-2026-02-07",
      status: "open" as const,
      start_date: "2026-02-01T00:00:00Z",
      end_date: "2026-02-07T23:59:59Z",
      issue_number: 1,
      bids: [
        {
          bidder: "test-bidder",
          amount: 100,
          banner_url: "https://example.com/banner.png",
          destination_url: "https://example.com",
          contact: "test@example.com",
          status: "approved" as const,
          comment_id: 123,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await Bun.write(
      join(e2eDir, ".bidme", "data", "current-period.json"),
      JSON.stringify(periodData, null, 2),
    );

    // Run close-bidding without STRIPE_SECRET_KEY to verify proper handling
    const { exitCode, stdout } = await runCli(["close-bidding", "--target", e2eDir]);

    // Verify the command ran successfully
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Closing Bidding Period");
    expect(stdout).toContain("Winner: @test-bidder with $100");

    // Verify Stripe skipped message appears (no STRIPE_SECRET_KEY in subprocess)
    expect(stdout).toContain("Stripe not configured");

    // Verify period was archived
    const archiveFiles = await readdir(join(e2eDir, ".bidme", "data", "archive"));
    expect(archiveFiles.length).toBeGreaterThan(0);
    expect(archiveFiles[0]).toContain("period-");

    // Verify archived period has winner info
    const archivedContent = await Bun.file(
      join(e2eDir, ".bidme", "data", "archive", archiveFiles[0]!),
    ).text();
    const archivedPeriod = JSON.parse(archivedContent);
    expect(archivedPeriod.status).toBe("closed");
    expect(archivedPeriod.bids[0].bidder).toBe("test-bidder");
    expect(archivedPeriod.bids[0].amount).toBe(100);
  });

  test("Stripe provider is configured by default in init", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);

    const configContent = await Bun.file(join(e2eDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(configContent);

    // Verify Stripe is the payment provider (not Polar)
    expect(parsed.payment.provider).toBe("stripe");
    // Verify no Polar references exist in config
    expect(configContent).not.toContain("polar");
  });
});
