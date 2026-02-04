import { describe, test, expect } from "bun:test";
import { resolve } from "path";
import { existsSync } from "fs";

const projectRoot = resolve(import.meta.dir, "../..");
const pkg = require(resolve(projectRoot, "package.json"));

const EXPECTED_SCRIPTS: Record<string, string> = {
  setup: "bun run scripts/setup.ts",
  demo: "bun run scripts/demo.ts",
  "open-bidding": "bun run scripts/bid-opener.ts",
  "close-bidding": "bun run scripts/bid-closer.ts",
  "update-analytics": "bun run scripts/analytics-updater.ts",
  test: "bun test",
  typecheck: "bun x tsc --noEmit",
};

describe("package.json scripts", () => {
  test("has a scripts section", () => {
    expect(pkg.scripts).toBeDefined();
    expect(typeof pkg.scripts).toBe("object");
  });

  for (const [name, command] of Object.entries(EXPECTED_SCRIPTS)) {
    test(`defines "${name}" script with correct command`, () => {
      expect(pkg.scripts[name]).toBe(command);
    });
  }

  test("has all expected scripts", () => {
    for (const name of Object.keys(EXPECTED_SCRIPTS)) {
      expect(pkg.scripts).toHaveProperty(name);
    }
  });

  describe("script file references", () => {
    const fileScripts = Object.entries(EXPECTED_SCRIPTS).filter(([, cmd]) =>
      cmd.includes("scripts/")
    );

    for (const [name, command] of fileScripts) {
      test(`"${name}" references an existing file`, () => {
        const match = command.match(/scripts\/[\w-]+\.ts/);
        expect(match).not.toBeNull();
        const filePath = resolve(projectRoot, match![0]);
        expect(existsSync(filePath)).toBe(true);
      });
    }
  });
});
