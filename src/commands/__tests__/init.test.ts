import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, stat, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { DEFAULT_CONFIG, parseToml } from "../../lib/config.js";

describe("init end-to-end", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-init-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("--defaults creates .bidme/ with config.toml, data files, and archive dir", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const configToml = Bun.file(join(tempDir, ".bidme", "config.toml"));
    expect(await configToml.exists()).toBe(true);

    const periodJson = Bun.file(join(tempDir, ".bidme", "data", "current-period.json"));
    expect(await periodJson.exists()).toBe(true);

    const analyticsJson = Bun.file(join(tempDir, ".bidme", "data", "analytics.json"));
    expect(await analyticsJson.exists()).toBe(true);

    const archiveStat = await stat(join(tempDir, ".bidme", "data", "archive"));
    expect(archiveStat.isDirectory()).toBe(true);
  });

  test("config.toml is valid and parseable with all expected sections", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const tomlContent = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    const parsed = parseToml(tomlContent);

    expect(parsed.bidding.schedule).toBe("monthly");
    expect(parsed.bidding.duration).toBe(7);
    expect(parsed.bidding.minimum_bid).toBe(50);
    expect(parsed.bidding.increment).toBe(5);

    expect(parsed.banner.width).toBe(800);
    expect(parsed.banner.height).toBe(100);
    expect(parsed.banner.formats).toEqual(["png", "jpg", "svg"]);
    expect(parsed.banner.max_size).toBe(200);

    expect(parsed.approval.mode).toBe("auto");
    expect(parsed.approval.allowed_reactions).toEqual(["👍"]);

    expect(parsed.payment.provider).toBe("polar-own");
    expect(parsed.payment.allow_unlinked_bids).toBe(false);
    expect(parsed.payment.unlinked_grace_hours).toBe(24);

    expect(parsed.enforcement.require_payment_before_bid).toBe(false);
    expect(parsed.enforcement.strikethrough_unlinked).toBe(true);

    expect(parsed.content_guidelines.prohibited).toEqual([
      "adult content",
      "gambling",
      "misleading claims",
    ]);
    expect(parsed.content_guidelines.required).toEqual([
      "alt text",
      "clear branding",
    ]);
  });

  test("README.md gets created with BIDME banner markers if it doesn't exist", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const readmeContent = await Bun.file(join(tempDir, "README.md")).text();
    expect(readmeContent).toContain("<!-- BIDME:BANNER:START -->");
    expect(readmeContent).toContain("<!-- BIDME:BANNER:END -->");
    expect(readmeContent).toContain("Sponsored via BidMe");
  });

  test("README.md gets markers prepended if it already exists without them", async () => {
    const existingContent = "# My Project\n\nSome existing content.\n";
    await Bun.write(join(tempDir, "README.md"), existingContent);

    await scaffold(tempDir, DEFAULT_CONFIG);

    const readmeContent = await Bun.file(join(tempDir, "README.md")).text();
    expect(readmeContent).toContain("<!-- BIDME:BANNER:START -->");
    expect(readmeContent).toContain("<!-- BIDME:BANNER:END -->");
    expect(readmeContent).toContain("# My Project");
    expect(readmeContent).toContain("Some existing content.");

    const bannerIdx = readmeContent.indexOf("<!-- BIDME:BANNER:START -->");
    const contentIdx = readmeContent.indexOf("# My Project");
    expect(bannerIdx).toBeLessThan(contentIdx);
  });

  test("running init twice doesn't duplicate markers or overwrite existing config", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    const firstToml = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    const firstReadme = await Bun.file(join(tempDir, "README.md")).text();

    const customConfig = {
      ...DEFAULT_CONFIG,
      bidding: { ...DEFAULT_CONFIG.bidding, minimum_bid: 999 },
    };
    await scaffold(tempDir, customConfig);

    const secondToml = await Bun.file(join(tempDir, ".bidme", "config.toml")).text();
    expect(secondToml).toBe(firstToml);

    const secondReadme = await Bun.file(join(tempDir, "README.md")).text();
    const startCount = (secondReadme.match(/<!-- BIDME:BANNER:START -->/g) || []).length;
    expect(startCount).toBe(1);

    const endCount = (secondReadme.match(/<!-- BIDME:BANNER:END -->/g) || []).length;
    expect(endCount).toBe(1);
  });

  test("workflow files are copied to .github/workflows/ when target is a git repo", async () => {
    await mkdir(join(tempDir, ".git"), { recursive: true });
    await Bun.write(
      join(tempDir, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/testowner/testrepo.git\n',
    );

    await scaffold(tempDir, DEFAULT_CONFIG);

    const workflowDir = join(tempDir, ".github", "workflows");
    const files = await readdir(workflowDir);
    const ymlFiles = files.filter((f) => f.endsWith(".yml"));

    expect(ymlFiles).toContain("bidme-schedule.yml");
    expect(ymlFiles).toContain("bidme-process-bid.yml");
    expect(ymlFiles).toContain("bidme-process-approval.yml");
    expect(ymlFiles).toContain("bidme-close-bidding.yml");
    expect(ymlFiles.length).toBe(4);

    const scheduleContent = await Bun.file(join(workflowDir, "bidme-schedule.yml")).text();
    expect(scheduleContent.length).toBeGreaterThan(0);

    const readme = await Bun.file(join(tempDir, "README.md")).text();
    expect(readme).toContain("testowner/testrepo");
  });
});
