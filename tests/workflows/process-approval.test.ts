import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "path";
import yaml from "js-yaml";

describe("process-approval workflow", () => {
  let workflow: any;

  beforeAll(async () => {
    const filePath = resolve(
      import.meta.dir,
      "../../.github/workflows/process-approval.yml",
    );
    const content = await Bun.file(filePath).text();
    workflow = yaml.load(content);
  });

  test("workflow file is valid YAML", () => {
    expect(workflow).toBeDefined();
    expect(typeof workflow).toBe("object");
  });

  test("has descriptive name", () => {
    expect(workflow.name).toBe("BidMe: Process Approval");
  });

  describe("triggers", () => {
    test("triggers on issue_comment edited events", () => {
      expect(workflow.on.issue_comment).toBeDefined();
      expect(workflow.on.issue_comment.types).toEqual(["edited"]);
    });

    test("does not trigger on created or deleted events", () => {
      const types = workflow.on.issue_comment.types;
      expect(types).not.toContain("created");
      expect(types).not.toContain("deleted");
    });

    test("supports workflow_dispatch for manual trigger", () => {
      expect(workflow.on.workflow_dispatch).toBeDefined();
    });

    test("workflow_dispatch has issue_number input", () => {
      const inputs = workflow.on.workflow_dispatch.inputs;
      expect(inputs.issue_number).toBeDefined();
      expect(inputs.issue_number.required).toBe(true);
    });

    test("workflow_dispatch has comment_id input", () => {
      const inputs = workflow.on.workflow_dispatch.inputs;
      expect(inputs.comment_id).toBeDefined();
      expect(inputs.comment_id.required).toBe(true);
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
      job = workflow.jobs["process-approval"];
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

      test("allows workflow_dispatch events", () => {
        expect(job.if).toContain("workflow_dispatch");
      });

      test("filters out pull request comments", () => {
        expect(job.if).toContain("!github.event.issue.pull_request");
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

      test("runs approval-processor script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("approval-processor"),
        );
        expect(processStep).toBeDefined();
        expect(processStep.run).toContain("bun run scripts/approval-processor.ts");
      });

      test("passes issue number to script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("approval-processor"),
        );
        expect(processStep.run).toContain(
          "github.event.issue.number",
        );
      });

      test("passes comment ID to script", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("approval-processor"),
        );
        expect(processStep.run).toContain(
          "github.event.comment.id",
        );
      });

      test("handles workflow_dispatch inputs", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("approval-processor"),
        );
        expect(processStep.run).toContain(
          "github.event.inputs.issue_number",
        );
        expect(processStep.run).toContain(
          "github.event.inputs.comment_id",
        );
      });

      test("passes GITHUB_TOKEN environment variable", () => {
        const processStep = job.steps.find(
          (s: any) => s.run && s.run.includes("approval-processor"),
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
          n.includes("Process") || n.includes("approval-processor"),
        );

        expect(checkoutIdx).toBeLessThan(bunIdx);
        expect(bunIdx).toBeLessThan(installIdx);
        expect(installIdx).toBeLessThan(processIdx);
      });
    });
  });
});
