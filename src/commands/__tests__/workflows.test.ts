import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolve, join } from "path";
import { mkdtemp, rm, readdir, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { scaffold } from "../../lib/scaffold.js";
import { DEFAULT_CONFIG } from "../../lib/config.js";

const WORKFLOW_FILES = [
  "bidme-schedule.yml",
  "bidme-process-bid.yml",
  "bidme-process-approval.yml",
  "bidme-close-bidding.yml",
  "bidme-check-grace.yml",
  "bidme-analytics.yml",
];

const TEMPLATES_DIR = resolve(import.meta.dir, "../../../templates/workflows");

function parseYamlLite(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (match) {
      const key = match[1];
      const value = match[2].trim();
      result[key] = value || true;
    }
  }
  return result;
}

describe("workflow template validation", () => {
  describe("YAML syntax and structure", () => {
    test("all 6 workflow template files exist", async () => {
      const entries = await readdir(TEMPLATES_DIR);
      const ymlFiles = entries.filter((f) => f.endsWith(".yml")).sort();
      expect(ymlFiles.length).toBe(6);
      for (const file of WORKFLOW_FILES) {
        expect(ymlFiles).toContain(file);
      }
    });

    for (const filename of WORKFLOW_FILES) {
      test(`${filename} is valid YAML (parseable, non-empty)`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content.length).toBeGreaterThan(0);

        const topLevel = parseYamlLite(content);
        expect(topLevel).toBeDefined();
        expect(typeof topLevel).toBe("object");
      });
    }
  });

  describe("required workflow fields", () => {
    for (const filename of WORKFLOW_FILES) {
      test(`${filename} has 'name' field`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toMatch(/^name:\s*.+/m);
      });

      test(`${filename} has 'on' trigger field`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toMatch(/^on:\s*/m);
      });

      test(`${filename} has 'jobs' field`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toMatch(/^jobs:\s*/m);
      });

      test(`${filename} has 'permissions' field`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toMatch(/^permissions:\s*/m);
      });
    }
  });

  describe("workflows use bun x bidme commands (not local scripts)", () => {
    for (const filename of WORKFLOW_FILES) {
      test(`${filename} uses 'bun x bidme' command`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toMatch(/bun x bidme\s+\S+/);
      });

      test(`${filename} does not reference local script paths`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).not.toMatch(/node\s+scripts\//);
        expect(content).not.toMatch(/bun\s+run\s+scripts\//);
        expect(content).not.toMatch(/\.\/scripts\//);
      });
    }
  });

  describe("workflow action versions", () => {
    for (const filename of WORKFLOW_FILES) {
      test(`${filename} uses actions/checkout@v4`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toContain("actions/checkout@v4");
      });

      test(`${filename} uses oven-sh/setup-bun@v2`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toContain("oven-sh/setup-bun@v2");
      });

      test(`${filename} uses stefanzweifel/git-auto-commit-action@v5`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toContain("stefanzweifel/git-auto-commit-action@v5");
      });
    }
  });

  describe("specific workflow commands", () => {
    test("schedule workflow runs 'bun x bidme open-bidding'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-schedule.yml")).text();
      expect(content).toContain("bun x bidme open-bidding");
    });

    test("process-bid workflow runs 'bun x bidme process-bid'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-process-bid.yml")).text();
      expect(content).toContain("bun x bidme process-bid");
    });

    test("process-approval workflow runs 'bun x bidme process-approval'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-process-approval.yml")).text();
      expect(content).toContain("bun x bidme process-approval");
    });

    test("close-bidding workflow runs 'bun x bidme close-bidding'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-close-bidding.yml")).text();
      expect(content).toContain("bun x bidme close-bidding");
    });

    test("check-grace workflow runs 'bun x bidme check-grace'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-check-grace.yml")).text();
      expect(content).toContain("bun x bidme check-grace");
    });

    test("analytics workflow runs 'bun x bidme update-analytics'", async () => {
      const content = await Bun.file(join(TEMPLATES_DIR, "bidme-analytics.yml")).text();
      expect(content).toContain("bun x bidme update-analytics");
    });
  });

  describe("commit message convention", () => {
    for (const filename of WORKFLOW_FILES) {
      test(`${filename} uses 'chore(bidme): update data' commit message`, async () => {
        const content = await Bun.file(join(TEMPLATES_DIR, filename)).text();
        expect(content).toContain('commit_message: "chore(bidme): update data"');
      });
    }
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

  test("init copies all 6 workflow files to .github/workflows/", async () => {
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    const workflowDir = join(tempDir, ".github", "workflows");
    const files = await readdir(workflowDir);
    const ymlFiles = files.filter((f) => f.endsWith(".yml"));

    expect(ymlFiles.length).toBe(6);
    for (const file of WORKFLOW_FILES) {
      expect(ymlFiles).toContain(file);
    }
    expect(result.workflowsCopied.length).toBe(6);
  });

  test("copied workflow content matches template source", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);

    for (const filename of WORKFLOW_FILES) {
      const templateContent = await Bun.file(join(TEMPLATES_DIR, filename)).text();
      const copiedContent = await Bun.file(
        join(tempDir, ".github", "workflows", filename),
      ).text();
      expect(copiedContent).toBe(templateContent);
    }
  });

  test("init does not overwrite existing workflows", async () => {
    const workflowDir = join(tempDir, ".github", "workflows");
    await mkdir(workflowDir, { recursive: true });

    const customContent = "# custom workflow - do not overwrite";
    await Bun.write(join(workflowDir, "bidme-schedule.yml"), customContent);
    await Bun.write(join(workflowDir, "bidme-analytics.yml"), customContent);

    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(result.workflowsSkipped).toContain("bidme-schedule.yml");
    expect(result.workflowsSkipped).toContain("bidme-analytics.yml");
    expect(result.workflowsSkipped.length).toBe(2);
    expect(result.workflowsCopied.length).toBe(4);

    const preserved = await Bun.file(join(workflowDir, "bidme-schedule.yml")).text();
    expect(preserved).toBe(customContent);

    const preservedAnalytics = await Bun.file(join(workflowDir, "bidme-analytics.yml")).text();
    expect(preservedAnalytics).toBe(customContent);
  });

  test("init copies redirect.html to .bidme/", async () => {
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(result.redirectCopied).toBe(true);
    const redirectFile = Bun.file(join(tempDir, ".bidme", "redirect.html"));
    expect(await redirectFile.exists()).toBe(true);

    const content = await redirectFile.text();
    expect(content).toContain("BidMe");
  });

  test("second init skips all existing workflows", async () => {
    await scaffold(tempDir, DEFAULT_CONFIG);
    const result = await scaffold(tempDir, DEFAULT_CONFIG);

    expect(result.workflowsCopied).toEqual([]);
    expect(result.workflowsSkipped.length).toBe(6);
    for (const file of WORKFLOW_FILES) {
      expect(result.workflowsSkipped).toContain(file);
    }
  });
});
