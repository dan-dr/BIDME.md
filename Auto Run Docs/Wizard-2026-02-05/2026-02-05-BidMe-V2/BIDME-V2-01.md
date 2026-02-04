# Phase 01: Foundation & Interactive CLI Prototype

This phase transforms BidMe from a private GitHub-Actions-only tool into a publishable npm/bun CLI package with an interactive setup wizard. By the end, running `bun run cli init --target /tmp/test-repo` will launch a beautiful terminal UI (via @bombshell-dev/clack) that walks through configuration and scaffolds a complete `.bidme/` folder with TOML config, GitHub Actions workflows, and a README placeholder — all working end-to-end. This is the exciting "it works!" moment.

## Tasks

- [x] Restructure the project for CLI package publishing:
  - Update `package.json`: remove `"private": true`, set `"name": "bidme"`, add `"version": "0.2.0"`, add `"bin": { "bidme": "./dist/cli.js" }`, add `"files": ["dist", "templates"]`, set `"type": "module"`
  - Add new dependencies: `@clack/prompts` (interactive CLI), `@clack/core`, `@iarna/toml` (TOML read/write), `commander` (CLI arg parsing)
  - Remove `js-yaml` and `@types/js-yaml` from dependencies
  - Add build script: `"build": "bun build src/cli.ts --outdir dist --target node"` and `"cli": "bun run src/cli.ts"`
  - Create `src/` directory as the new source root (the old `scripts/` will be migrated in later phases)
  - Update `tsconfig.json`: add `"src"` to include array, add path alias `"@src/*": ["./src/*"]`

- [x] Create the CLI entry point and command router: *(Completed: src/cli.ts with commander, shebang, init/update/version commands; src/commands/init.ts stub; all 470 tests pass, typecheck clean)*
  - `src/cli.ts` — main entry point using `commander`:
    - `bidme init [--target <path>] [--defaults]` — interactive setup wizard
    - `bidme update` — placeholder that prints "Update command coming soon"
    - `bidme version` — prints package version from package.json
  - The `--target` flag allows specifying a directory (defaults to cwd), critical for local testing: `bun run cli init --target /tmp/test-repo`
  - The `--defaults` flag skips interactive prompts and uses all defaults (for CI/testing)
  - Include shebang `#!/usr/bin/env node` at top of cli.ts for npx/bunx compatibility

- [x] Build the interactive setup wizard using @clack/prompts: *(Completed: src/commands/init.ts with clack.intro/select/text/multiselect/spinner/outro; WizardConfig interface & DEFAULT_WIZARD_CONFIG; collectConfig() with all 10 prompts; runInit() with --defaults bypass; cancel handling on every prompt; dynamic scaffold import for forward-compat; 470 tests pass, typecheck clean)*
  - `src/commands/init.ts` — the init command implementation:
    - Use `clack.intro()` with styled "BidMe Setup" banner
    - First prompt: "Default setup or Customize?" using `clack.select()`
    - If customize, show prompts for:
      - Bidding schedule: weekly or monthly (`clack.select()`)
      - Bidding duration in days (`clack.text()` with validation)
      - Minimum bid amount in USD (`clack.text()` with validation)
      - Bid increment in USD (`clack.text()` with validation)
      - Banner max width and height (`clack.text()`)
      - Banner accepted formats (`clack.multiselect()` — png, jpg, svg, gif, webp)
      - Banner max file size in KB (`clack.text()`)
      - Bid approval mode: auto-accept all OR emoji react to approve (`clack.select()`)
      - Payment mode: "Bring your own Polar.sh" or "Use BidMe managed (coming soon)" (`clack.select()`)
      - Allow unlinked bidders: yes (with warnings) or no (strict) (`clack.select()`)
    - If default, use all default values silently
    - Use `clack.spinner()` during file creation steps
    - Use `clack.outro()` with success message and next steps
  - All prompts must have sensible defaults matching current config values
  - If `--defaults` flag is set, skip all prompts entirely and use defaults

- [x] Create the TOML config generator and `.bidme/` scaffolding: *(Completed: src/lib/config.ts with BidMeConfig interface, DEFAULT_CONFIG, generateToml(), parseToml(); src/lib/scaffold.ts with scaffold() creating .bidme/ directory structure, TOML config, data files, git repo detection, workflow template copying, README.md banner placeholder insertion; init.ts updated to use direct imports instead of dynamic import; 470 tests pass, typecheck clean)*
  - `src/lib/config.ts` — config types and TOML serialization:
    - Define `BidMeConfig` interface (same fields as current but restructured):
      - `bidding`: schedule, duration, minimum_bid, increment
      - `banner`: width, height, formats (array not comma string), max_size
      - `approval`: mode ("auto" | "emoji"), allowed_reactions (default ["👍"])
      - `payment`: provider ("polar-own" | "bidme-managed"), allow_unlinked_bids (boolean), unlinked_grace_hours (default 24)
      - `enforcement`: require_payment_before_bid (boolean), strikethrough_unlinked (boolean)
      - `content_guidelines`: prohibited (string[]), required (string[])
    - `generateToml(config: BidMeConfig): string` — generates well-commented TOML with section headers
    - `DEFAULT_CONFIG` constant with all defaults
  - `src/lib/scaffold.ts` — directory and file creation:
    - Creates `.bidme/` directory structure:
      - `.bidme/config.toml` — generated from user choices
      - `.bidme/data/current-period.json` — empty period state
      - `.bidme/data/analytics.json` — empty analytics
      - `.bidme/data/archive/` — empty archive directory
    - Detects git repo and copies workflow templates to `.github/workflows/`
    - Updates or creates README.md with BidMe banner placeholder:
      - Between `<!-- BIDME:BANNER:START -->` and `<!-- BIDME:BANNER:END -->` markers
      - Placeholder content: a markdown image linking to the first bid issue URL (use `https://github.com/{owner}/{repo}/issues?q=label%3Abidme` as placeholder href)
      - Also include a small "Sponsored via BidMe" text link

- [x] Create workflow template files in `templates/workflows/`: *(Completed: 4 workflow templates created — bidme-schedule.yml (monthly cron + manual, opens bidding), bidme-process-bid.yml (issue_comment created, bidme label filter), bidme-process-approval.yml (issue_comment edited, bidme label filter), bidme-close-bidding.yml (daily cron + manual, POLAR_ACCESS_TOKEN); all use oven-sh/setup-bun@v2 and bun x bidme commands; scaffold.ts copyWorkflowTemplates() verified to correctly resolve templates/workflows/ path; 470 tests pass)*
  - `templates/workflows/bidme-schedule.yml` — opens bidding period on cron (monthly or weekly based on config). Uses `oven-sh/setup-bun@v2`, runs `bun x bidme open-bidding`. Permissions: contents write, issues write.
  - `templates/workflows/bidme-process-bid.yml` — triggers on issue_comment created, filters for bidme label, runs `bun x bidme process-bid`. Permissions: contents write, issues write.
  - `templates/workflows/bidme-process-approval.yml` — triggers on issue_comment edited, runs `bun x bidme process-approval`. Permissions: contents write, issues write.
  - `templates/workflows/bidme-close-bidding.yml` — daily cron, runs `bun x bidme close-bidding`. Permissions: contents write, issues write. Requires POLAR_ACCESS_TOKEN secret.
  - These are template files that the init command copies into the target repo's `.github/workflows/` directory
  - Use Bun setup action in all workflows
  - All workflows should install via `bun x bidme` (the published package) rather than local script paths

- [x] Create a test script that validates the full init flow end-to-end: *(Completed: src/commands/__tests__/init.test.ts with 6 tests covering scaffold output, TOML validity, README creation/prepend, idempotency, and workflow copying; fixed detectGitRepo bug where Bun.file().exists() failed on directories — switched to fs.stat(); 476 tests pass, typecheck clean)*
  - `src/commands/__tests__/init.test.ts`:
    - Test 1: Running init with `--defaults` against a temp directory creates `.bidme/config.toml`, `.bidme/data/current-period.json`, `.bidme/data/analytics.json`, `.bidme/data/archive/`
    - Test 2: Config TOML is valid and parseable, contains all expected sections
    - Test 3: README.md gets created with BIDME banner markers if it doesn't exist
    - Test 4: README.md gets markers prepended if it already exists without them
    - Test 5: Running init twice doesn't duplicate markers or overwrite existing config
    - Test 6: Workflow files are copied to `.github/workflows/` when target is a git repo
    - Use `Bun.spawn` or direct function calls for testing
    - Use temp directories for isolation

- [x] Run the init test suite and fix any failures until all tests pass. Then do a manual smoke test by running `bun run cli init --defaults --target /tmp/bidme-test` and verify: *(Completed: All 6 init tests pass, full suite 476/476 pass; manual smoke test confirmed .bidme/config.toml (valid TOML, 6 sections, correct defaults), .bidme/data/current-period.json, .bidme/data/analytics.json, .bidme/data/archive/, and README.md with BIDME banner markers and "Sponsored via BidMe" text)*
  - The `.bidme/` folder was created with all expected files
  - `config.toml` is valid TOML with correct default values
  - `README.md` has the banner placeholder
  - Print the contents of the created files to verify correctness
