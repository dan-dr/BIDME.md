import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { DEFAULT_CONFIG } from "../../lib/config.js";

const WORKFLOW_FILES = [
  "bidme-open.yml",
  "bidme-process-bid.yml",
  "bidme-close.yml",
  "bidme-analytics.yml",
];

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/workflows");

describe("workflow template validation", () => {
  test("only the four GitHub-variable workflows are shipped", async () => {
    const ymlFiles = (await readdir(TEMPLATES_DIR)).filter((f) => f.endsWith(".yml")).sort();
    expect(ymlFiles).toEqual([...WORKFLOW_FILES].sort());
  });

  for (const filename of WORKFLOW_FILES) {
    test(`${filename} has required workflow structure`, async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
      expect(content).toMatch(/^name:\s*.+/m);
      expect(content).toMatch(/^on:\s*/m);
      expect(content).toMatch(/^permissions:\s*/m);
      expect(content).toMatch(/^jobs:\s*/m);
      expect(content).toContain("actions/checkout@v4");
      expect(content).toContain("uses: dan-dr/BIDME.md@main");
      expect(content).toContain("GITHUB_TOKEN");
      expect(content).not.toContain("bunx bidme");
    });
  }

  test("workflows run the expected bidme commands", async () => {
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-open.yml")).text()).toContain("command: open-bidding");
    const processBid = await Bun.file(join(TEMPLATES_DIR, "bidme-process-bid.yml")).text();
    expect(processBid).toContain("command: process-bid");
    expect(processBid).toContain("contains(github.event.comment.body, 'bid:')");
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-close.yml")).text()).toContain("command: close-bidding");
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-analytics.yml")).text()).toContain("command: update-analytics");
  });

  test("repository action owns runtime dependency setup", async () => {
    const action = await Bun.file(resolve(import.meta.dir, "../../../action.yml")).text();
    expect(action).toContain('using: "composite"');
    expect(action).toContain("oven-sh/setup-bun@v2");
    expect(action).toContain("bun install --frozen-lockfile");
    expect(action).toContain("src/action.ts");
  });

  test("only close workflow commits archive and README changes", async () => {
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-close.yml")).text()).toContain("stefanzweifel/git-auto-commit-action@v5");
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-process-bid.yml")).text()).not.toContain("git-auto-commit-action");
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-analytics.yml")).text()).not.toContain("git-auto-commit-action");
    expect(await Bun.file(join(TEMPLATES_DIR, "bidme-open.yml")).text()).not.toContain("git-auto-commit-action");
  });
});

describe("init copies workflows correctly", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "bidme-wf-test-"));
    await mkdir(join(tempDir, ".git"), { recursive: true });
    await Bun.write(
      join(tempDir, ".git", "config"),
      '[remote "origin"]\n\turl = https://github.com/testowner/testrepo.git\n',
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("init copies all four workflow files to .github/workflows/", async () => {
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    const files = await readdir(join(tempDir, ".github", "workflows"));
    const ymlFiles = files.filter((f) => f.endsWith(".yml")).sort();

    expect(ymlFiles).toEqual([...WORKFLOW_FILES].sort());
    expect(result.workflowsCopied.sort()).toEqual([...WORKFLOW_FILES].sort());
  });

  test("init does not overwrite existing workflows", async () => {
    const workflowDir = join(tempDir, ".github", "workflows");
    await mkdir(workflowDir, { recursive: true });

    const customContent = "# custom workflow - do not overwrite";
    await Bun.write(join(workflowDir, "bidme-open.yml"), customContent);
    await Bun.write(join(workflowDir, "bidme-analytics.yml"), customContent);

    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(result.workflowsSkipped.sort()).toEqual(["bidme-analytics.yml", "bidme-open.yml"]);
    expect(result.workflowsCopied.sort()).toEqual(["bidme-close.yml", "bidme-process-bid.yml"]);
    expect(await Bun.file(join(workflowDir, "bidme-open.yml")).text()).toBe(customContent);
  });

  test("second init skips all existing workflows", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(result.workflowsCopied).toEqual([]);
    expect(result.workflowsSkipped.sort()).toEqual([...WORKFLOW_FILES].sort());
  });
});
