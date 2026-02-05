---
type: analysis
title: Refactoring Game Plan - BidMe v0.2.0
created: 2026-02-05
tags:
  - refactoring
  - code-quality
  - analysis
related:
  - "[[1_ANALYZE]]"
---

# Refactoring Game Plan

## Codebase Profile
- **Total Files:** 38 source files (TypeScript, `.ts` only)
- **Total LOC:** ~9,537 (source + tests)
- **Largest Files:**
  | File | LOC | Notes |
  |------|-----|-------|
  | `commands/__tests__/bidding.test.ts` | 701 | Test file |
  | `lib/__tests__/content-enforcer.test.ts` | 635 | Test file |
  | `commands/__tests__/check-grace.test.ts` | 535 | Test file |
  | `commands/__tests__/payment-enforcement.test.ts` | 486 | Test file |
  | `lib/__tests__/migrations.test.ts` | 467 | Test file |
  | `lib/migrations/v0.2.0.ts` | 350 | Migration logic |
  | `commands/close-bidding.ts` | 302 | **Needs refactoring** |
  | `lib/config.ts` | 285 | Complex validation |
  | `commands/process-bid.ts` | 270 | **Needs refactoring** |
  | `commands/init.ts` | 230 | Scaffold logic |
- **Key Directories:**
  - `src/commands/` — CLI command handlers (9 files)
  - `src/lib/` — Shared libraries & utilities (11 files)
  - `src/lib/migrations/` — Config migration logic (2 files)
  - `src/commands/__tests__/` — Command tests (8 files)
  - `src/lib/__tests__/` — Library tests (5 files)
  - `templates/` — Workflow template files
- **Existing Patterns:**
  - `runXxx()` command pattern per file
  - `loadConfig()` centralized config with TOML parsing
  - `GitHubAPI` class for all GitHub interactions
  - `withRetry()` / `logError()` / `isRateLimited()` error utilities
  - `BidderRegistry` for bidder tracking with cache
  - `AnalyticsStore` for analytics with immutable updates
  - Return type `{ success: boolean; message: string }` from commands

## Investigation Tactics

### Tactic 1: GitHub Environment Setup Duplication
- **Target:** Duplicated `process.env` parsing for `GITHUB_REPOSITORY_OWNER` / `GITHUB_REPOSITORY`
- **Search Pattern:**
  ```bash
  grep -rn 'GITHUB_REPOSITORY_OWNER' src/commands/
  grep -rn 'fullRepo.includes' src/commands/
  ```
- **Files to Check:** `src/commands/{close-bidding,process-bid,process-approval,open-bidding,update-analytics,check-grace}.ts`
- **Why It Matters:** 18+ lines duplicated across 6 files. Single extraction to a `getGitHubRepoInfo()` utility eliminates all duplication and ensures consistent behavior.

### Tactic 2: Period Data Load/Save Duplication
- **Target:** Repeated JSON file reading/writing for `current-period.json`
- **Search Pattern:**
  ```bash
  grep -rn 'current-period.json' src/
  grep -rn 'periodFile.exists' src/commands/
  grep -rn 'JSON.stringify(periodData' src/
  ```
- **Files to Check:** `src/commands/{close-bidding,process-bid,process-approval,check-grace,daily-recap}.ts`
- **Why It Matters:** 8-10 lines × 5 files = 40-50 duplicated lines. A `loadPeriodData()` / `savePeriodData()` utility centralizes file I/O, error messaging, and validation.

### Tactic 3: Monster Functions — close-bidding & process-bid
- **Target:** Functions over 150 LOC with deep nesting and multiple responsibilities
- **Search Pattern:**
  ```bash
  # Count lines per exported function
  grep -n 'export async function' src/commands/close-bidding.ts src/commands/process-bid.ts
  ```
- **Files to Check:**
  - `src/commands/close-bidding.ts` — `runCloseBidding()` is ~200 lines (lines 103-302), handles payment, README updates, archiving, winner announcement
  - `src/commands/process-bid.ts` — `runProcessBid()` is ~254 lines (lines 16-270), handles parsing, validation, content enforcement, payment links, issue updates
- **Why It Matters:** These are the two most complex functions in the codebase. Breaking each into 3-4 focused helper functions improves readability, testability, and reduces cognitive load.

### Tactic 4: JSON File I/O Scatter
- **Target:** Raw `Bun.write(..., JSON.stringify(..., null, 2))` and `JSON.parse(await Bun.file(...).text())` patterns
- **Search Pattern:**
  ```bash
  grep -rn 'JSON.stringify.*null.*2' src/
  grep -rn 'JSON.parse.*Bun.file' src/
  grep -rn 'Bun.write.*JSON' src/
  ```
- **Files to Check:** All `src/commands/*.ts` and `src/lib/{analytics-store,bidder-registry,config,scaffold}.ts`
- **Why It Matters:** 20+ occurrences of raw JSON file I/O. A `readJSON<T>()` / `writeJSON<T>()` utility reduces boilerplate and provides a single place to add error handling or atomic writes.

### Tactic 5: CLI Action Boilerplate
- **Target:** Repeated `.action()` handler pattern in `cli.ts`
- **Search Pattern:**
  ```bash
  grep -n '.action(' src/cli.ts
  grep -n 'process.exit(1)' src/cli.ts
  ```
- **Files to Check:** `src/cli.ts` (lines 28-130)
- **Why It Matters:** 9 nearly identical action handlers with import → run → exit pattern. A `wrapCommand()` helper could reduce ~80 lines of boilerplate to ~20.

### Tactic 6: Dead Exports & Unused Functions
- **Target:** Exported functions never imported outside their own module (excluding tests)
- **Search Pattern:**
  ```bash
  # For each exported function, check if it's imported elsewhere
  grep -rn 'export function\|export async function\|export const' src/lib/ --include='*.ts' --exclude-dir='__tests__'
  # Then cross-reference with imports
  grep -rn 'from.*badge-generator' src/ --include='*.ts'
  grep -rn 'from.*validation' src/ --include='*.ts'
  grep -rn 'from.*analytics-store' src/ --include='*.ts'
  ```
- **Files to Check:**
  - `src/lib/badge-generator.ts` — `generateViewsBadge()`, `generateCountriesBadge()`, `generateCTRBadge()` (never called)
  - `src/lib/validation.ts` — `validateBannerUrl()` (superseded by content-enforcer)
  - `src/lib/analytics-store.ts` — `aggregateByPeriod()` (never used)
  - `src/lib/issue-template.ts` — `generatePreviousStatsSection()` (unused wrapper)
- **Why It Matters:** Dead code increases maintenance burden and confuses new contributors. Removing unused exports keeps the surface area clean.

### Tactic 7: Inconsistent Error Handling
- **Target:** `BidMeError` class defined but rarely used; most errors use generic `Error`
- **Search Pattern:**
  ```bash
  grep -rn 'new BidMeError' src/
  grep -rn 'new Error(' src/
  grep -rn 'BidMeErrorCode' src/lib/error-handler.ts
  ```
- **Files to Check:** `src/lib/error-handler.ts`, all `src/commands/*.ts`
- **Why It Matters:** Many error codes defined (`CONFIG_MISSING`, `CONFIG_INVALID`, `CONCURRENT_WRITE`, etc.) but commands throw generic `Error`. Either adopt `BidMeError` consistently or simplify the error types.

### Tactic 8: Config Validation Complexity
- **Target:** `validateConfig()` at 83 lines with sequential validation checks
- **Search Pattern:**
  ```bash
  grep -n 'function validateConfig' src/lib/config.ts
  ```
- **Files to Check:** `src/lib/config.ts` (lines 110-193)
- **Why It Matters:** Long validation functions are hard to extend and test. Breaking into `validateBiddingConfig()`, `validateBannerConfig()`, `validatePaymentConfig()` improves modularity.

### Tactic 9: Local Mode Detection Duplication
- **Target:** Repeated `if (!owner || !repo)` local-mode fallback logic
- **Search Pattern:**
  ```bash
  grep -rn 'local mode' src/commands/
  grep -rn '!owner.*!repo\|!repo.*!owner' src/commands/
  ```
- **Files to Check:** `src/commands/{close-bidding,process-bid,process-approval,open-bidding,update-analytics}.ts`
- **Why It Matters:** 5-15 lines × 5 files. A shared `requireGitHubEnv()` or `isLocalMode()` utility ensures consistent messaging and behavior.

### Tactic 10: Issue Body Update Duplication
- **Target:** Analytics loading + issue body regeneration pattern repeated across commands
- **Search Pattern:**
  ```bash
  grep -rn 'updateBidIssueBody\|updateIssueBody' src/commands/
  grep -rn 'loadAnalytics' src/commands/
  ```
- **Files to Check:** `src/commands/{process-bid,process-approval}.ts`
- **Why It Matters:** ~14 lines duplicated. An `updateIssueWithLatestBids()` helper encapsulates the analytics-load → body-generate → API-update pipeline.

## Priority Order

| Priority | Tactic | Impact | Effort |
|----------|--------|--------|--------|
| P1 | Tactic 1: GitHub env extraction | High (6 files) | Low |
| P1 | Tactic 2: Period data store | High (5 files) | Low |
| P1 | Tactic 3: Monster function splits | High (complexity) | Medium |
| P2 | Tactic 4: JSON I/O utilities | Medium (20+ sites) | Low |
| P2 | Tactic 5: CLI action wrapper | Medium (9 handlers) | Low |
| P2 | Tactic 6: Dead code removal | Medium (cleanliness) | Low |
| P2 | Tactic 9: Local mode utility | Medium (5 files) | Low |
| P3 | Tactic 7: Error handling consistency | Low-Medium | Medium |
| P3 | Tactic 8: Config validation split | Low-Medium | Low |
| P3 | Tactic 10: Issue body update helper | Low (2 files) | Low |

## Estimated Impact
- **Lines eliminated:** 300-500 through deduplication
- **Complexity reduction:** 2 major functions split into 6-8 focused helpers
- **Files most needing attention:** `close-bidding.ts`, `process-bid.ts`, then all command files for shared utility extraction
