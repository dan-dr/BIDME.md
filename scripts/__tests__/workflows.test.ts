import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import { readdir } from "fs/promises";
import yaml from "js-yaml";

const workflowDir = resolve(import.meta.dir, "../../.github/workflows");

const WORKFLOW_FILES = [
  "schedule-bidding.yml",
  "process-bid.yml",
  "process-approval.yml",
  "close-bidding.yml",
  "update-analytics.yml",
];

const EXPECTED_SCRIPTS: Record<string, string[]> = {
  "schedule-bidding.yml": ["scripts/bid-opener.ts"],
  "process-bid.yml": ["scripts/bid-processor.ts"],
  "process-approval.yml": ["scripts/approval-processor.ts"],
  "close-bidding.yml": ["scripts/bid-closer.ts"],
  "update-analytics.yml": ["scripts/handle-click.ts", "scripts/analytics-updater.ts"],
};

const CRON_REGEX = /^(\*|([0-5]?\d))(\/\d+)?\s+(\*|([01]?\d|2[0-3]))(\/\d+)?\s+(\*|([12]?\d|3[01]))(\/\d+)?\s+(\*|(1[0-2]|0?[1-9]))(\/\d+)?\s+(\*|[0-6])(\/\d+)?$/;

function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const ranges = [
    { min: 0, max: 59 },   // minute
    { min: 0, max: 23 },   // hour
    { min: 1, max: 31 },   // day of month
    { min: 1, max: 12 },   // month
    { min: 0, max: 6 },    // day of week
  ];

  return parts.every((part, i) => {
    if (part === "*") return true;
    // Handle */N step values
    if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2), 10);
      return !isNaN(step) && step > 0;
    }
    // Handle plain numbers
    const num = parseInt(part, 10);
    if (!isNaN(num)) return num >= ranges[i].min && num <= ranges[i].max;
    // Handle comma-separated values
    if (part.includes(",")) {
      return part.split(",").every((v) => {
        const n = parseInt(v, 10);
        return !isNaN(n) && n >= ranges[i].min && n <= ranges[i].max;
      });
    }
    // Handle ranges (e.g. 1-5)
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return !isNaN(lo) && !isNaN(hi) && lo >= ranges[i].min && hi <= ranges[i].max && lo <= hi;
    }
    return false;
  });
}

function getAllSteps(workflow: any): any[] {
  const steps: any[] = [];
  for (const jobName of Object.keys(workflow.jobs || {})) {
    const job = workflow.jobs[jobName];
    if (Array.isArray(job.steps)) {
      steps.push(...job.steps);
    }
  }
  return steps;
}

function getAllRunCommands(workflow: any): string[] {
  return getAllSteps(workflow)
    .filter((s: any) => s.run)
    .map((s: any) => s.run as string);
}

describe("GitHub Actions workflow validation", () => {
  const workflows: Record<string, any> = {};

  beforeAll(async () => {
    for (const file of WORKFLOW_FILES) {
      const filePath = resolve(workflowDir, file);
      const content = await Bun.file(filePath).text();
      workflows[file] = yaml.load(content);
    }
  });

  describe("all workflow files exist and are valid YAML", () => {
    test("workflow directory contains all expected files", async () => {
      const files = await readdir(workflowDir);
      for (const expected of WORKFLOW_FILES) {
        expect(files).toContain(expected);
      }
    });

    for (const file of WORKFLOW_FILES) {
      test(`${file} parses as valid YAML`, () => {
        expect(workflows[file]).toBeDefined();
        expect(typeof workflows[file]).toBe("object");
      });
    }
  });

  describe("required fields present in all workflows", () => {
    for (const file of WORKFLOW_FILES) {
      describe(file, () => {
        test("has a name field", () => {
          expect(workflows[file].name).toBeDefined();
          expect(typeof workflows[file].name).toBe("string");
          expect(workflows[file].name.length).toBeGreaterThan(0);
        });

        test("has 'on' triggers defined", () => {
          const w = workflows[file];
          expect(w.on || w[true]).toBeDefined();
        });

        test("has permissions defined", () => {
          expect(workflows[file].permissions).toBeDefined();
          expect(typeof workflows[file].permissions).toBe("object");
        });

        test("has at least one job", () => {
          expect(workflows[file].jobs).toBeDefined();
          expect(Object.keys(workflows[file].jobs).length).toBeGreaterThan(0);
        });

        test("each job has steps", () => {
          const jobs = workflows[file].jobs;
          for (const jobName of Object.keys(jobs)) {
            expect(jobs[jobName].steps).toBeDefined();
            expect(Array.isArray(jobs[jobName].steps)).toBe(true);
            expect(jobs[jobName].steps.length).toBeGreaterThan(0);
          }
        });
      });
    }
  });

  describe("each workflow references the correct Bun script", () => {
    for (const file of WORKFLOW_FILES) {
      test(`${file} runs expected script(s)`, () => {
        const runCommands = getAllRunCommands(workflows[file]);
        const allRunText = runCommands.join("\n");
        for (const script of EXPECTED_SCRIPTS[file]) {
          expect(allRunText).toContain(script);
        }
      });
    }
  });

  describe("environment variables are passed correctly", () => {
    test("schedule-bidding passes GITHUB_TOKEN", () => {
      const steps = getAllSteps(workflows["schedule-bidding.yml"]);
      const scriptStep = steps.find((s: any) => s.run?.includes("bid-opener"));
      expect(scriptStep?.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    });

    test("process-bid passes GITHUB_TOKEN", () => {
      const steps = getAllSteps(workflows["process-bid.yml"]);
      const scriptStep = steps.find((s: any) => s.run?.includes("bid-processor"));
      expect(scriptStep?.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    });

    test("process-approval passes GITHUB_TOKEN", () => {
      const steps = getAllSteps(workflows["process-approval.yml"]);
      const scriptStep = steps.find((s: any) => s.run?.includes("approval-processor"));
      expect(scriptStep?.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    });

    test("close-bidding passes GITHUB_TOKEN and POLAR_ACCESS_TOKEN", () => {
      const steps = getAllSteps(workflows["close-bidding.yml"]);
      const scriptStep = steps.find((s: any) => s.run?.includes("bid-closer"));
      expect(scriptStep?.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
      expect(scriptStep?.env?.POLAR_ACCESS_TOKEN).toBe("${{ secrets.POLAR_ACCESS_TOKEN }}");
    });

    test("update-analytics track-click passes CLIENT_PAYLOAD", () => {
      const steps = getAllSteps(workflows["update-analytics.yml"]);
      const clickStep = steps.find((s: any) => s.run?.includes("handle-click"));
      expect(clickStep?.env?.CLIENT_PAYLOAD).toBeDefined();
      expect(clickStep.env.CLIENT_PAYLOAD).toContain("github.event.client_payload");
    });

    test("update-analytics update step passes GITHUB_TOKEN", () => {
      const steps = getAllSteps(workflows["update-analytics.yml"]);
      const analyticsStep = steps.find((s: any) => s.run?.includes("analytics-updater"));
      expect(analyticsStep?.env?.GITHUB_TOKEN).toBe("${{ secrets.GITHUB_TOKEN }}");
    });
  });

  describe("schedule cron expressions are valid", () => {
    test("schedule-bidding has valid monthly cron", () => {
      const schedule = workflows["schedule-bidding.yml"].on.schedule;
      expect(schedule).toBeDefined();
      expect(Array.isArray(schedule)).toBe(true);
      const cron = schedule[0].cron;
      expect(isValidCron(cron)).toBe(true);
      // Verify it's monthly (day-of-month is a specific number, not *)
      const parts = cron.trim().split(/\s+/);
      expect(parseInt(parts[2], 10)).toBeGreaterThanOrEqual(1);
      expect(parseInt(parts[2], 10)).toBeLessThanOrEqual(31);
    });

    test("close-bidding has valid daily cron", () => {
      const schedule = workflows["close-bidding.yml"].on.schedule;
      expect(schedule).toBeDefined();
      const cron = schedule[0].cron;
      expect(isValidCron(cron)).toBe(true);
      // Daily: day-of-month, month, day-of-week should all be *
      const parts = cron.trim().split(/\s+/);
      expect(parts[2]).toBe("*");
      expect(parts[3]).toBe("*");
      expect(parts[4]).toBe("*");
    });

    test("update-analytics has valid periodic cron", () => {
      const schedule = workflows["update-analytics.yml"].on.schedule;
      expect(schedule).toBeDefined();
      const cron = schedule[0].cron;
      expect(isValidCron(cron)).toBe(true);
    });
  });

  describe("all workflows share common setup patterns", () => {
    for (const file of WORKFLOW_FILES) {
      describe(file, () => {
        test("every job uses ubuntu-latest", () => {
          const jobs = workflows[file].jobs;
          for (const jobName of Object.keys(jobs)) {
            expect(jobs[jobName]["runs-on"]).toBe("ubuntu-latest");
          }
        });

        test("every job starts with checkout and bun setup", () => {
          const jobs = workflows[file].jobs;
          for (const jobName of Object.keys(jobs)) {
            const steps = jobs[jobName].steps;
            const checkoutIdx = steps.findIndex(
              (s: any) => s.uses?.startsWith("actions/checkout"),
            );
            const bunIdx = steps.findIndex(
              (s: any) => s.uses?.startsWith("oven-sh/setup-bun"),
            );
            const installIdx = steps.findIndex(
              (s: any) => s.run?.includes("bun install"),
            );
            expect(checkoutIdx).toBeGreaterThanOrEqual(0);
            expect(bunIdx).toBeGreaterThan(checkoutIdx);
            expect(installIdx).toBeGreaterThan(bunIdx);
          }
        });
      });
    }
  });

  describe("workflow-specific validations", () => {
    test("process-bid filters non-PR issue comments with bidme label", () => {
      const job = workflows["process-bid.yml"].jobs["process-bid"];
      expect(job.if).toContain("!github.event.issue.pull_request");
      expect(job.if).toContain("bidme");
    });

    test("process-approval supports both event-based and manual triggers", () => {
      const w = workflows["process-approval.yml"];
      expect(w.on.issue_comment).toBeDefined();
      expect(w.on.workflow_dispatch).toBeDefined();
      expect(w.on.workflow_dispatch.inputs.issue_number).toBeDefined();
      expect(w.on.workflow_dispatch.inputs.comment_id).toBeDefined();
    });

    test("close-bidding commits and pushes data changes", () => {
      const steps = getAllSteps(workflows["close-bidding.yml"]);
      const commitStep = steps.find(
        (s: any) => s.run?.includes("git commit"),
      );
      expect(commitStep).toBeDefined();
      expect(commitStep.run).toContain("git add data/");
      expect(commitStep.run).toContain("git push");
      expect(commitStep.run).toContain("git diff --staged --quiet ||");
    });

    test("update-analytics has separate track-click and update-analytics jobs", () => {
      const jobs = workflows["update-analytics.yml"].jobs;
      expect(jobs["track-click"]).toBeDefined();
      expect(jobs["update-analytics"]).toBeDefined();
    });

    test("update-analytics track-click only runs on repository_dispatch", () => {
      const job = workflows["update-analytics.yml"].jobs["track-click"];
      expect(job.if).toContain("repository_dispatch");
    });

    test("update-analytics supports repository_dispatch trigger with bidme-click type", () => {
      const w = workflows["update-analytics.yml"];
      expect(w.on.repository_dispatch).toBeDefined();
      expect(w.on.repository_dispatch.types).toContain("bidme-click");
    });

    test("schedule-bidding and close-bidding support workflow_dispatch", () => {
      expect(workflows["schedule-bidding.yml"].on.workflow_dispatch).toBeDefined();
      expect(workflows["close-bidding.yml"].on.workflow_dispatch).toBeDefined();
    });
  });

  describe("permissions are appropriately scoped", () => {
    test("all workflows have contents:write", () => {
      for (const file of WORKFLOW_FILES) {
        expect(workflows[file].permissions.contents).toBe("write");
      }
    });

    test("workflows that manage issues have issues:write", () => {
      const issueWorkflows = [
        "schedule-bidding.yml",
        "process-bid.yml",
        "process-approval.yml",
        "close-bidding.yml",
      ];
      for (const file of issueWorkflows) {
        expect(workflows[file].permissions.issues).toBe("write");
      }
    });

    test("update-analytics does not request issues permission", () => {
      expect(workflows["update-analytics.yml"].permissions.issues).toBeUndefined();
    });
  });
});
