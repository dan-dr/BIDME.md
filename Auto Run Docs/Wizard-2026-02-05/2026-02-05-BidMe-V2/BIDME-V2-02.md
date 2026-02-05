# Phase 02: TOML Config System & Core Library Migration

This phase replaces the YAML-based configuration system with TOML throughout the entire codebase, migrates core utility modules from `scripts/utils/` into the new `src/lib/` structure, and wires up the config loader to read from `.bidme/config.toml`. After this phase, the config system is fully operational with TOML, all shared libraries live under `src/lib/`, and the old YAML code paths are eliminated.

## Tasks

- [x] Build the TOML config loader that replaces the YAML one: *(Completed: added loadConfig(), saveConfig(), validateConfig(), deepMerge() to src/lib/config.ts; deleted scripts/utils/config.ts and bidme-config.yml; all src/ tests pass)*
  - `src/lib/config.ts` — extend the file created in Phase 01:
    - `loadConfig(targetDir?: string): Promise<BidMeConfig>` — loads `.bidme/config.toml` from the given directory (or cwd), deep-merges with DEFAULT_CONFIG
    - `saveConfig(config: BidMeConfig, targetDir?: string): Promise<void>` — writes config back to `.bidme/config.toml` with section comments
    - `validateConfig(config: unknown): BidMeConfig` — validates a parsed object against the schema, throws on invalid
    - Replace the `deepMerge` logic from `scripts/utils/config.ts` (keep the algorithm, update imports)
    - All paths should resolve relative to `.bidme/` folder, not project root
  - Delete `scripts/utils/config.ts` after confirming all references are updated
  - Delete `bidme-config.yml` from project root

- [x] Migrate core utility modules from `scripts/utils/` to `src/lib/`: *(Completed: migrated all 7 modules to src/lib/; fixed validation.ts and issue-template.ts to use config.banner.formats array instead of .format string split; updated issue-template.ts imports to use @scripts/ path alias; updated analytics-store.ts DEFAULT_PATH to .bidme/data/analytics.json; all src/ typechecks pass, 6/6 existing tests pass)*
  - `src/lib/github-api.ts` — copy from `scripts/utils/github-api.ts`, update imports to use `@src/lib/` paths
  - `src/lib/validation.ts` — copy from `scripts/utils/validation.ts`, update config import to new TOML-based config types
  - `src/lib/error-handler.ts` — copy from `scripts/utils/error-handler.ts` as-is
  - `src/lib/issue-template.ts` — copy from `scripts/utils/issue-template.ts`, update imports
  - `src/lib/badge-generator.ts` — copy from `scripts/utils/badge-generator.ts`, update imports
  - `src/lib/analytics-store.ts` — copy from `scripts/utils/analytics-store.ts`, update all data paths to use `.bidme/data/` instead of `data/`
  - `src/lib/polar-integration.ts` — copy from `scripts/utils/polar-integration.ts` as-is
  - Ensure all file paths in migrated modules reference `.bidme/data/` instead of `data/`

- [x] Update the config type definitions to support new v2 features: *(Completed: added tracking section to BidMeConfig interface; updated DEFAULT_CONFIG defaults — approval.mode→"emoji", enforcement.require_payment_before_bid→true, tracking.append_utm→true, tracking.utm_params→"source=bidme&repo={owner}/{repo}"; updated generateToml() with tracking section and inline comments; added tracking validation in validateConfig(); updated init.ts collectConfig() and wizard defaults; updated existing tests to match new defaults; all 6 tests pass, 0 src/ type errors)*
  - Add to `BidMeConfig` interface in `src/lib/config.ts`:
    - `approval.mode`: `"auto" | "emoji"` (default: "emoji")
    - `approval.allowed_reactions`: `string[]` (default: ["👍"])
    - `payment.provider`: `"polar-own" | "bidme-managed"` (default: "polar-own")
    - `payment.allow_unlinked_bids`: `boolean` (default: false)
    - `payment.unlinked_grace_hours`: `number` (default: 24)
    - `enforcement.require_payment_before_bid`: `boolean` (default: true)
    - `enforcement.strikethrough_unlinked`: `boolean` (default: true)
    - `tracking.append_utm`: `boolean` (default: true)
    - `tracking.utm_params`: `string` (default: "source=bidme&repo={owner}/{repo}")
  - Update `generateToml()` to output all new sections with helpful inline comments
  - Update `DEFAULT_CONFIG` with all new defaults

- [x] Write tests for the TOML config system: *(Completed: created src/lib/__tests__/config.test.ts with 16 tests covering loadConfig, saveConfig round-trip, validateConfig rejection cases, generateToml comment preservation, and deep-merge with partial configs; all 22 src/ tests pass)*
  - `src/lib/__tests__/config.test.ts`:
    - Test loading a valid `.bidme/config.toml` file
    - Test deep-merge with partial config (missing sections filled from defaults)
    - Test loading when no config file exists (returns all defaults)
    - Test saving and re-loading round-trips correctly
    - Test validation rejects invalid values (negative bid amounts, invalid schedule strings)
    - Test that TOML comments are preserved in output
  - Use temp directories for file operations

- [x] Run config tests and fix any failures. Then verify `bun run cli init --defaults --target /tmp/bidme-config-test` creates a valid `.bidme/config.toml` that can be loaded by the new `loadConfig()` function. *(Completed: all 16 config tests + 6 init tests pass; CLI `init --defaults` creates valid config.toml; loadConfig() successfully loads and round-trips the CLI-generated config matching all DEFAULT_CONFIG values; added 2 integration tests — scaffold+loadConfig round-trip and CLI subprocess+loadConfig round-trip; 24 src/ tests total, 0 failures)*
