import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, stat } from "fs/promises";
import { tmpdir } from "os";
import { parseToml } from "../lib/config.js";
import { runUpdate } from "../commands/update.js";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function runCli(args: string[], cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: cwd ?? PROJECT_ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GITHUB_REPOSITORY_OWNER: "",
      GITHUB_REPOSITORY: "",
      STRIPE_SECRET_KEY: "",
    },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

async function runAction(command: string, target: string, cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", "run", "src/action.ts"], {
    cwd: cwd ?? PROJECT_ROOT,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      INPUT_COMMAND: command,
      INPUT_TARGET: target,
      GITHUB_REPOSITORY_OWNER: "",
      GITHUB_REPOSITORY: "",
      STRIPE_SECRET_KEY: "",
    },
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
    await Bun.spawn(["git", "init"], { cwd: e2eDir, stdout: "pipe", stderr: "pipe" }).exited;
    await Bun.spawn(["git", "commit", "--allow-empty", "-m", "init"], {
      cwd: e2eDir,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@test.com",
      },
    }).exited;
  });

  afterEach(async () => {
    await rm(e2eDir, { recursive: true });
  });

  test("init --defaults creates new-spec files only", async () => {
    const { exitCode } = await runCli(["init", "--defaults", "--target", e2eDir]);
    expect(exitCode).toBe(0);

    expect(await fileExists(join(e2eDir, ".bidme", "config.toml"))).toBe(true);
    expect(await fileExists(join(e2eDir, ".bidme", "version.json"))).toBe(true);
    expect(await fileExists(join(e2eDir, "404.html"))).toBe(true);
    expect(await fileExists(join(e2eDir, "bidme", "redirect.html"))).toBe(true);
    expect(await fileExists(join(e2eDir, "bidme", "stripe", "success.html"))).toBe(true);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "archive", ".gitkeep"))).toBe(true);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "current-period.json"))).toBe(false);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "analytics.json"))).toBe(false);
    expect(await fileExists(join(e2eDir, ".bidme", "data", "bidders.json"))).toBe(false);
    expect(await dirExists(join(e2eDir, ".bidme", "data", "archive"))).toBe(true);

    const readme = await Bun.file(join(e2eDir, "README.md")).text();
    expect(readme).toContain("<!-- bidme-banner-start -->");
    expect(readme).toContain("<!-- bidme-banner-end -->");
    expect(readme).toContain("Your_Ad_Here");

    const workflows = (await readdir(join(e2eDir, ".github", "workflows")))
      .filter((f) => f.startsWith("bidme-") && f.endsWith(".yml"))
      .sort();
    expect(workflows).toEqual([
      "bidme-analytics.yml",
      "bidme-close.yml",
      "bidme-open.yml",
      "bidme-process-bid.yml",
    ]);
  });

  test("config.toml parses with new payment and tracking defaults", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);
    const parsed = parseToml(await Bun.file(join(e2eDir, ".bidme", "config.toml")).text());

    expect(parsed.bidding.schedule).toBe("monthly");
    expect(parsed.banner.formats).toEqual(["png", "jpg", "svg", "webp"]);
    expect(parsed.approval.mode).toBe("emoji");
    expect(parsed.payment.mode).toBe("own_keys");
    expect(parsed.payment.bidme_fee_percent).toBe(10);
    expect(parsed.tracking.utm_params).toBe("utm_source=bidme&utm_campaign={owner}/{repo}");
  });

  test("open-bidding in local mode reports variable-store requirement instead of writing runtime files", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);
    const { exitCode, stdout } = await runAction("open-bidding", e2eDir);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("GitHub environment not configured");
    expect(stdout).toContain("BIDME_CURRENT_PERIOD not written");
    expect(await fileExists(join(e2eDir, ".bidme", "data", "current-period.json"))).toBe(false);
  });

  test("doctor validates local files and reports missing external setup", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);
    const { exitCode, stdout } = await runCli(["doctor", "--target", e2eDir]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("✓ .bidme/config.toml valid");
    expect(stdout).toContain("✓ Workflow files present");
    expect(stdout).toContain("✓ README banner placeholder present");
    expect(stdout).toContain("✗ STRIPE_SECRET_KEY");
  });

  test("version.json contains package version", async () => {
    await runCli(["init", "--defaults", "--target", e2eDir]);
    const version = JSON.parse(await Bun.file(join(e2eDir, ".bidme", "version.json")).text());
    const pkg = JSON.parse(await Bun.file(join(PROJECT_ROOT, "package.json")).text());
    expect(version.version).toBe(pkg.version);
    expect(version.installed_at).toBeDefined();
    expect(version.last_updated).toBeDefined();
  });

  test("legacy v1 update still migrates old data into .bidme/data", async () => {
    const v1Dir = await mkdtemp(resolve(tmpdir(), "bidme-v1-test-"));
    try {
      await Bun.write(
        join(v1Dir, "bidme-config.yml"),
        "bidding:\n  schedule: weekly\n  duration: 14\n  minimum_bid: 100\n  increment: 10\n",
      );
      await Bun.write(join(v1Dir, "data", "current-period.json"), JSON.stringify({ period: null }));
      await Bun.write(join(v1Dir, "data", "analytics.json"), JSON.stringify({ periods: [] }));

      const result = await runUpdate({ target: v1Dir });
      expect(result.success).toBe(true);
      expect(result.migrationsRun).toContain("0.2.0");
      expect(await fileExists(join(v1Dir, ".bidme", "config.toml"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "data", "current-period.json"))).toBe(true);
      expect(await fileExists(join(v1Dir, ".bidme", "data", "analytics.json"))).toBe(true);
    } finally {
      await rm(v1Dir, { recursive: true });
    }
  });
});
