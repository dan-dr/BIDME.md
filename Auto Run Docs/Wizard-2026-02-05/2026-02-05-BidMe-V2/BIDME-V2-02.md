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

- [ ] Migrate core utility modules from `scripts/utils/` to `src/lib/`:
  - `src/lib/github-api.ts` — copy from `scripts/utils/github-api.ts`, update imports to use `@src/lib/` paths
  - `src/lib/validation.ts` — copy from `scripts/utils/validation.ts`, update config import to new TOML-based config types
  - `src/lib/error-handler.ts` — copy from `scripts/utils/error-handler.ts` as-is
  - `src/lib/issue-template.ts` — copy from `scripts/utils/issue-template.ts`, update imports
  - `src/lib/badge-generator.ts` — copy from `scripts/utils/badge-generator.ts`, update imports
  - `src/lib/analytics-store.ts` — copy from `scripts/utils/analytics-store.ts`, update all data paths to use `.bidme/data/` instead of `data/`
  - `src/lib/polar-integration.ts` — copy from `scripts/utils/polar-integration.ts` as-is
  - Ensure all file paths in migrated modules reference `.bidme/data/` instead of `data/`

- [ ] Update the config type definitions to support new v2 features:
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

- [ ] Write tests for the TOML config system:
  - `src/lib/__tests__/config.test.ts`:
    - Test loading a valid `.bidme/config.toml` file
    - Test deep-merge with partial config (missing sections filled from defaults)
    - Test loading when no config file exists (returns all defaults)
    - Test saving and re-loading round-trips correctly
    - Test validation rejects invalid values (negative bid amounts, invalid schedule strings)
    - Test that TOML comments are preserved in output
  - Use temp directories for file operations

- [ ] Run config tests and fix any failures. Then verify `bun run cli init --defaults --target /tmp/bidme-config-test` creates a valid `.bidme/config.toml` that can be loaded by the new `loadConfig()` function.
