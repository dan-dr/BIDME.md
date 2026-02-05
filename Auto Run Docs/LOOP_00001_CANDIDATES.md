---
type: analysis
title: Refactoring Candidates - BidMe v0.2.0
created: 2026-02-05
tags:
  - refactoring
  - candidates
  - code-quality
related:
  - "[[LOOP_00001_GAME_PLAN]]"
  - "[[1_ANALYZE]]"
---

# Refactoring Candidates

---

## Tactic 1: GitHub Environment Setup Duplication - Executed 2026-02-05 00:00

### Finding 1: Identical 3-line env parsing block duplicated across 6 command files
- **Category:** Duplication
- **Location:** `src/commands/close-bidding.ts:153-155`, `src/commands/process-bid.ts:45-47`, `src/commands/process-approval.ts:62-64`, `src/commands/open-bidding.ts:57-59`, `src/commands/update-analytics.ts:101-103`, `src/commands/check-grace.ts:57-59`
- **Current State:** Every command file independently reads `GITHUB_REPOSITORY_OWNER` and `GITHUB_REPOSITORY` from `process.env`, then parses the repo name from the full repo string. The exact same 3 lines are repeated 6 times:
- **Proposed Change:** Extract a `getGitHubRepoInfo()` utility in `src/lib/` that returns `{ owner: string; repo: string }` from environment variables. All 6 files import and call this single function.
- **Code Context:**
  ```typescript
  // Repeated identically in 6 files:
  const owner = process.env["GITHUB_REPOSITORY_OWNER"] ?? "";
  const fullRepo = process.env["GITHUB_REPOSITORY"] ?? "";
  const repo = fullRepo.includes("/") ? fullRepo.split("/")[1]! : fullRepo;
  ```

### Finding 2: Local-mode detection logic (`!owner || !repo`) duplicated with varying messages
- **Category:** Duplication
- **Location:** `src/commands/close-bidding.ts:157-158`, `src/commands/process-bid.ts:52-55`, `src/commands/process-approval.ts:66-69`, `src/commands/open-bidding.ts:61-62`, `src/commands/update-analytics.ts:105-106`, `src/commands/check-grace.ts:61-64`
- **Current State:** After the 3-line env parsing block, each file checks `if (!owner || !repo)` and logs a slightly different local-mode warning. Some return early, some set fallback values, some skip functionality. The local-mode check is always present but the behavior varies per command.
- **Proposed Change:** The env parsing itself should be centralized (Finding 1). The local-mode branching is command-specific and can remain, but the check should use a shared `isLocalMode()` predicate or the utility could return `null` when env is missing, making the check more ergonomic. Note: This overlaps with Tactic 9 (Local Mode Detection Duplication).
- **Code Context:**
  ```typescript
  // close-bidding.ts:157
  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");

  // process-bid.ts:52
  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    commentBody = "";
    bidder = "local-user";

  // process-approval.ts:66
  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — running in local mode");
    console.log("  Cannot check reactions without GitHub API");
    return { success: false, message: "GitHub environment not configured" };

  // open-bidding.ts:61
  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY)");

  // update-analytics.ts:105
  if (!owner || !repo) {
    console.log("\n⚠ GitHub environment not configured — skipping traffic fetch");

  // check-grace.ts:61-64
  let api: GitHubAPI | null = null;
  if (owner && repo) {
    api = new GitHubAPI(owner, repo);
  }
  ```

### Finding 3: GitHubAPI instantiation always follows env parsing
- **Category:** Duplication / Organization
- **Location:** `src/commands/close-bidding.ts:~175`, `src/commands/process-bid.ts:57`, `src/commands/process-approval.ts:72`, `src/commands/open-bidding.ts:74`, `src/commands/update-analytics.ts:117`, `src/commands/check-grace.ts:62-63`
- **Current State:** In every command, `new GitHubAPI(owner, repo)` is called right after the local-mode check passes. The env parsing → local-mode check → API creation pipeline is repeated fully in all 6 files.
- **Proposed Change:** A `getGitHubAPI()` utility could return `GitHubAPI | null`, encapsulating the entire env-parse → check → instantiate pipeline. Commands then just check `if (!api) { /* local fallback */ }`.
- **Code Context:**
  ```typescript
  // Pattern in every non-local branch:
  const api = new GitHubAPI(owner, repo);
  ```

### Finding 4: Test files duplicate env setup/teardown for the same variables
- **Category:** Duplication
- **Location:** `src/commands/__tests__/bidding.test.ts:268-269,641-642`, `src/commands/__tests__/process-approval.test.ts:44-45,132-133`, `src/commands/__tests__/payment-enforcement.test.ts:187-188,315-316,411-412`, `src/commands/__tests__/check-grace.test.ts:105-106,465-466`, `src/commands/__tests__/update-analytics.test.ts:356-357,363-364`
- **Current State:** 5 test files each manually set/delete `GITHUB_REPOSITORY_OWNER` and `GITHUB_REPOSITORY` in `beforeEach`/`afterEach` blocks. The setup is identical across all test files.
- **Proposed Change:** Create a test helper `setupGitHubEnv()` / `teardownGitHubEnv()` or a shared `beforeEach`/`afterEach` fixture. If the utility from Finding 1 is extracted, tests can also mock the utility directly instead of manipulating `process.env`.
- **Code Context:**
  ```typescript
  // Repeated in 5+ test files:
  process.env["GITHUB_REPOSITORY_OWNER"] = "testowner";
  process.env["GITHUB_REPOSITORY"] = "testowner/testrepo";
  // ... and in teardown:
  delete process.env["GITHUB_REPOSITORY_OWNER"];
  delete process.env["GITHUB_REPOSITORY"];
  ```

### Tactic Summary
- **Issues Found:** 4
- **Files Affected:** 6 command files + 5 test files = 11 files total
- **Duplicated Lines:** ~18 lines of env parsing (3 lines × 6 files) + ~30 lines of local-mode checks + ~12 lines of test env setup = ~60 lines of duplication
- **Status:** EXECUTED
