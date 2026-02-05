# Phase 07: Update/Migration System & Full Integration Testing

This phase builds the `bidme update` command with migration support for upgrading existing BidMe installations, rewrites the README to reflect the v2 architecture, runs the complete test suite, and performs a full end-to-end validation. After this phase, BidMe v2 is ready for npm publishing and real-world testing on a live repo.

## Tasks

- [x] Build the `bidme update` command with migration system:
  - `src/commands/update.ts`:
    - Detects current BidMe version by reading `.bidme/version.json` (contains `{ version: "0.2.0", installed_at, last_updated }`)
    - Compares installed version against package version
    - If versions match: "Already up to date!"
    - If upgrade needed: runs applicable migrations in sequence
    - Migration framework:
      - `src/lib/migrations/index.ts` — exports a sorted array of migration objects: `{ version: string, description: string, migrate: (targetDir: string) => Promise<void> }`
      - `src/lib/migrations/v0.2.0.ts` — migration from v1 (legacy) to v2:
        - Moves `bidme-config.yml` → converts to `.bidme/config.toml` (parse YAML, generate TOML)
        - Moves `data/` → `.bidme/data/` (preserving analytics.json and archive/)
        - Updates workflow files in `.github/workflows/` to v2 format (replace old filenames with new `bidme-*` prefixed ones, update script references from `bun run scripts/...` to `bun x bidme ...`)
        - Updates README.md banner markers if format changed
        - Creates `.bidme/version.json`
        - Deletes old files: `bidme-config.yml`, `data/` directory
    - After migration: updates `.bidme/version.json` with new version
    - Prints summary of what was migrated
  - Register as CLI command: `bidme update` in `src/cli.ts`
  - Update `src/commands/init.ts` to create `.bidme/version.json` during fresh installs

- [x] Create the migration from v1 to v2: *(Completed: implemented migrateReadme() with v2 banner format, added current-period.json and analytics.json schema normalization during data migration, added 7 new tests covering readme migration + data schema normalization. All 25 migration tests pass.)*
  - `src/lib/migrations/v0.2.0.ts`:
    - `migrateConfig()`: reads `bidme-config.yml`, parses YAML, maps to new TOML structure:
      - `bidding.*` maps directly
      - `banner.format` string → `banner.formats` array (split on comma)
      - `content_guidelines.*` maps directly
      - `analytics.*` maps to inline config (no standalone dashboard)
      - Adds new sections with defaults: `approval`, `payment`, `enforcement`, `tracking`
    - `migrateData()`: moves `data/` contents to `.bidme/data/`:
      - `current-period.json` — copy if exists, add any new required fields
      - `analytics.json` — copy, normalize schema if structure changed
      - `archive/` — copy entire directory
    - `migrateWorkflows()`: for each old workflow in `.github/workflows/`:
      - `schedule-bidding.yml` → `bidme-schedule.yml`
      - `process-bid.yml` → `bidme-process-bid.yml`
      - `process-approval.yml` → `bidme-process-approval.yml`
      - `close-bidding.yml` → `bidme-close-bidding.yml`
      - `update-analytics.yml` → `bidme-analytics.yml`
      - Replace contents with v2 templates, delete old files
    - `migrateReadme()`: update banner markers and placeholder format if needed
    - Each step should be idempotent (safe to run twice)

- [x] Rewrite README.md to document BidMe v2: *(Completed: removed all badges, restructured with title/one-liner/Quick Start/How It Works 4-step flow/Configuration with config.toml example/Commands table (all 9 CLI commands)/Payment Setup/For Advertisers/License. Concise, no walls of text.)*
  - Remove all badges from the top of the README
  - New README structure:
    - **Title**: BidMe — Auction-Based README Sponsorships
    - **One-liner description**: "Let companies bid for banner space in your README. Highest approved bid wins."
    - **Quick Start**: `bunx bidme init` or `npx bidme init` — that's it. 3 lines max.
    - **How It Works**: 4-step flow (Init → Bidding Opens → Bids Come In → Winner Goes Live)
    - **Configuration**: show example `.bidme/config.toml` with key sections explained
    - **Commands**: table of all CLI commands (`init`, `update`, `open-bidding`, `close-bidding`, `process-bid`, `process-approval`, `check-grace`, `update-analytics`, `daily-recap`)
    - **Payment Setup**: Polar.sh token instructions (brief)
    - **For Advertisers**: bid format, rules, payment linking requirement
    - **License**: MIT
  - Keep it concise — no walls of text. The CLI interactive wizard handles most setup questions.

- [x] Write migration tests: *(Verified: all 25 tests in src/lib/__tests__/migrations.test.ts already cover every requirement — config YAML→TOML (5 tests), data migration (5 tests), workflow renaming (3 tests), readme migration (5 tests), cleanup (1 test), full idempotency (1 test), update command version detection (3 tests), migration framework sorting/filtering (2 tests). All pass with 84 expect() calls.)*
  - `src/lib/__tests__/migrations.test.ts`:
    - Test v1→v2 config migration: YAML input → TOML output with correct values
    - Test v1→v2 data migration: files moved from `data/` to `.bidme/data/`
    - Test v1→v2 workflow migration: old filenames replaced with new ones
    - Test migration is idempotent (running twice doesn't break anything)
    - Test update command detects version mismatch and runs migration
    - Test update command reports "already up to date" when versions match
  - Use temp directories with pre-populated v1 file structures

- [x] Run the complete test suite and fix all failures: *(Completed: Fixed 4 test failures caused by shallow-copy mutation of DEFAULT_CONFIG in migrateConfig() — replaced with JSON deep clone. Fixed 11 TypeScript errors: `as typeof fetch` → `as unknown as typeof fetch` in 4 test files, added `bidme_fee_percent` to init.ts payment config, fixed regex match indexing in workflows.test.ts. No obsolete v1 test files found. All 339 tests pass, 877 expect() calls, 0 TypeScript errors.)*
  - Run `bun test` from the project root
  - Fix any broken tests from earlier phases that reference old file paths
  - Delete any remaining test files under `tests/` and `scripts/__tests__/` that test old v1 code — these are obsolete since the modules they test have been deleted/replaced
  - Ensure all new tests under `src/` pass
  - Run `bun run typecheck` and fix any TypeScript errors

- [ ] Full end-to-end smoke test:
  - Create a temp directory and initialize a git repo in it: `git init /tmp/bidme-e2e && cd /tmp/bidme-e2e && git commit --allow-empty -m "init"`
  - Run `bun run cli init --defaults --target /tmp/bidme-e2e`
  - Verify all files created: `.bidme/config.toml`, `.bidme/data/*`, `.bidme/version.json`, `.bidme/redirect.html`, `.github/workflows/bidme-*.yml`, README.md with banner placeholder
  - Verify config.toml parses correctly with `@iarna/toml`
  - Run `bun run cli open-bidding` (should fail gracefully with "GitHub environment not configured" in local mode — this is expected and correct)
  - Test the v1→v2 migration: create a second temp dir with v1 file layout (bidme-config.yml + data/ folder), run `bun run cli update --target /tmp/bidme-v1-test`, verify migration completed
  - Print a summary of what works
