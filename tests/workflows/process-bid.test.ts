import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import yaml from "js-yaml";

describe("process-bid workflow", () => {
  let workflow: any;

  beforeAll(async () => {
    const filePath = resolve(
      import.meta.dir,
      "../../.github/workflows/process-bid.yml",
    );
    const content = await Bun.file(filePath).text();
    workflow = yaml.load(content);
  });

  test("workflow file is valid YAML", () => {
    expect(workflow).toBeDefined();
    expect(typeof workflow).toBe("object");
  });

  test("has descriptive name", () => {
    expect(workflow.name).toBe("BidMe: Process Bid");
  });

  describe("triggers", () => {
    test("triggers on issue_comment created events", () => {
      expect(workflow.on.issue_comment).toBeDefined();
      expect(workflow.on.issue_comment.types).toEqual(["created"]);
    });

    test("does not trigger on other event types", () => {
      const types = workflow.on.issue_comment.types;
      expect(types).not.toContain("edited");
      expect(types).not.toContain("deleted");
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
      job = workflow.jobs["process-bid"];
    });

    test("job exists", () => {
      expect(job).toBeDefined();
    });

    test("runs on ubuntu-latest", () => {
      expect(job["runs-on"]).toBe("ubuntu-latest");
    });

    describe("conditions", () => {
      test("has an if condition", () => {
        expect(job.if).toBeDefined();
      });

      test("filters out pull request comments", () => {
        expect(job.if).toContain("!github.event.issue.pull_request");
      });

      test("requires YAML frontmatter markers in comment", () => {
        expect(job.if).toContain("github.event.comment.body");
        expect(job.if).toContain("---");
      });

      test("requires bidme label on issue", () => {
        expect(job.if).toContain("bidme");
        expect(job.if).toContain("github.event.issue.labels");
      });
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

      test("runs bid-processor script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-processor"),
        );
        expect(processStep).toBeDefined();
        expect(processStep.run).toContain("bun run scripts/bid-processor.ts");
      });

      test("passes issue number to script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-processor"),
        );
        expect(processStep.run).toContain(
          "github.event.issue.number",
        );
      });

      test("passes comment ID to script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-processor"),
        );
        expect(processStep.run).toContain(
          "github.event.comment.id",
        );
      });

      test("passes GITHUB_TOKEN environment variable", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("bid-processor"),
        );
        expect(processStep.env).toBeDefined();
        expect(processStep.env.GITHUB_TOKEN).toBe(
          "${{ secrets.GITHUB_TOKEN }}",
        );
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
        const processIdx = stepNames.findIndex((n: string) =>
          n.includes("Process") || n.includes("bid-processor"),
        );

        expect(checkoutIdx).toBeLessThan(bunIdx);
        expect(bunIdx).toBeLessThan(installIdx);
        expect(installIdx).toBeLessThan(processIdx);
      });
    });
  });
});
