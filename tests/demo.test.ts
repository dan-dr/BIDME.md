import { describe, test, expect } from "bun:test";
import { resolve } from "path";

describe("demo script", () => {
  const demoPath = resolve(import.meta.dir, "../scripts/demo.ts");

  test("runs successfully and produces expected output", async () => {
    const proc = Bun.spawn(["bun", "run", demoPath], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("=== BidMe Demo ===");
    expect(stdout).toContain("✓ Config loaded");
    expect(stdout).toContain("✓ Bid parsed");
    expect(stdout).toContain("✓ Validation passed");
    expect(stdout).toContain("✓ Generated markdown output");
    expect(stdout).toContain("=== Demo complete ===");
  });

  test("outputs correct config values", async () => {
    const proc = Bun.spawn(["bun", "run", demoPath], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(stdout).toContain("Schedule: monthly");
    expect(stdout).toContain("Minimum bid: $50");
    expect(stdout).toContain("Increment: $5");
    expect(stdout).toContain("Banner: 800x100px");
  });

  test("outputs correct parsed bid values", async () => {
    const proc = Bun.spawn(["bun", "run", demoPath], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(stdout).toContain("Amount: $100");
    expect(stdout).toContain("Banner: https://example.com/my-banner.png");
    expect(stdout).toContain("Destination: https://example.com/landing");
    expect(stdout).toContain("Contact: @bidder123");
  });

  test("outputs generated markdown with badges", async () => {
    const proc = Bun.spawn(["bun", "run", demoPath], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();

    expect(stdout).toContain("[![BidMe Banner]");
    expect(stdout).toContain("shields.io/badge");
    expect(stdout).toContain("12.5k");
    expect(stdout).toContain("views");
    expect(stdout).toContain("countries");
    expect(stdout).toContain("CTR");
  });
});
