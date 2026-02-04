import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import yaml from "js-yaml";

describe("close-bidding workflow", () => {
  let workflow: any;

  beforeAll(async () => {
    const filePath = resolve(
      import.meta.dir,
      "../../.github/workflows/close-bidding.yml",
    );
    const content = await Bun.file(filePath).text();
    workflow = yaml.load(content);
  });

  test("workflow file is valid YAML", () => {
    expect(workflow).toBeDefined();
    expect(typeof workflow).toBe("object");
  });

  test("has descriptive name", () => {
    expect(workflow.name).toBe("BidMe: Close Bidding Period");
  });

  describe("triggers", () => {
    test("triggers on schedule", () => {
      expect(workflow.on.schedule).toBeDefined();
      expect(Array.isArray(workflow.on.schedule)).toBe(true);
    });

    test("schedule runs daily", () => {
      const cron = workflow.on.schedule[0].cron;
      expect(cron).toBeDefined();
      // Daily cron: minute hour * * * (wildcard for day-of-month, month, day-of-week)
      const parts = cron.split(" ");
      expect(parts.length).toBe(5);
      expect(parts[2]).toBe("*"); // day-of-month = every day
      expect(parts[3]).toBe("*"); // month = every month
      expect(parts[4]).toBe("*"); // day-of-week = every day
    });

    test("supports workflow_dispatch for manual trigger", () => {
      expect(workflow.on.workflow_dispatch).toBeDefined();
    });
  });

  describe("permissions", () => {
    test("has contents write permission", () => {
      expect(workflow.permissions.contents).toBe("write");
    });

    test("has issues write permission", () => {
      expect(workflow.permissions.issues).toBe("write");
    });
  });

  describe("job configuration", () => {
    let job: any;

    beforeAll(() => {
      job = workflow.jobs["close-bidding"];
    });

    test("job exists", () => {
      expect(job).toBeDefined();
    });

    test("runs on ubuntu-latest", () => {
      expect(job["runs-on"]).toBe("ubuntu-latest");
    });

    describe("steps", () => {
      test("checks out repository", () => {
        const checkoutStep = job.steps.find(
          (s: any) => s.uses && s.uses.startsWith("actions/checkout"),
        );
        expect(checkoutStep).toBeDefined();
      });

      test("sets up Bun", () => {
        const bunStep = job.steps.find(
          (s: any) => s.uses && s.uses.startsWith("oven-sh/setup-bun"),
        );
        expect(bunStep).toBeDefined();
      });

      test("installs dependencies", () => {
        const installStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bun install"),
        );
        expect(installStep).toBeDefined();
      });

      test("runs bid-closer script", () => {
        const closeStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-closer"),
        );
        expect(closeStep).toBeDefined();
        expect(closeStep.run).toContain("bun run scripts/bid-closer.ts");
      });

      test("passes GITHUB_TOKEN environment variable", () => {
        const closeStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-closer"),
        );
        expect(closeStep.env).toBeDefined();
        expect(closeStep.env.GITHUB_TOKEN).toBe(
          "${{ secrets.GITHUB_TOKEN }}",
        );
      });

      test("passes POLAR_ACCESS_TOKEN environment variable", () => {
        const closeStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-closer"),
        );
        expect(closeStep.env.POLAR_ACCESS_TOKEN).toBe(
          "${{ secrets.POLAR_ACCESS_TOKEN }}",
        );
      });

      test("has commit and push step after bid-closer", () => {
        const commitStep = job.steps.find(
          (s: any) => s.run && s.run.includes("git commit"),
        );
        expect(commitStep).toBeDefined();
        expect(commitStep.run).toContain("git add data/");
        expect(commitStep.run).toContain("git push");
      });

      test("commit step only commits if there are changes", () => {
        const commitStep = job.steps.find(
          (s: any) => s.run && s.run.includes("git commit"),
        );
        expect(commitStep.run).toContain("git diff --staged --quiet ||");
      });

      test("follows correct step order", () => {
        const stepNames = job.steps.map(
          (s: any) => s.name || s.run || "unknown",
        );
        const checkoutIdx = stepNames.findIndex((n: string) =>
          n.includes("Checkout"),
        );
        const bunIdx = stepNames.findIndex((n: string) =>
          n.includes("Bun"),
        );
        const installIdx = stepNames.findIndex((n: string) =>
          n.includes("Install") || n.includes("bun install"),
        );
        const closeIdx = stepNames.findIndex((n: string) =>
          n.includes("Close") || n.includes("bid-closer"),
        );
        const commitIdx = stepNames.findIndex((n: string) =>
          n.includes("Commit") || n.includes("git commit"),
        );

        expect(checkoutIdx).toBeLessThan(bunIdx);
        expect(bunIdx).toBeLessThan(installIdx);
        expect(installIdx).toBeLessThan(closeIdx);
        expect(closeIdx).toBeLessThan(commitIdx);
      });
    });
  });
});
