---
type: analysis
title: Refactoring Plan - Loop 00001
created: 2026-02-05
tags:
  - refactoring
  - plan
  - code-quality
related:
  - "[[LOOP_00001_CANDIDATES]]"
  - "[[3_EVALUATE]]"
---

# Refactoring Plan - Loop 00001

## Summary
- **Total Candidates:** 4
- **PENDING (auto-implement):** 1
- **PENDING - MANUAL REVIEW:** 0
- **WON'T DO:** 0
- **Unevaluated:** 3

## Status Matrix

| # | Candidate | Risk | Benefit | Status |
|---|-----------|------|---------|--------|
| 1 | Env parsing block duplication (Finding 1) | LOW | MEDIUM | PENDING |

## Detailed Evaluations

### 1. Identical 3-line env parsing block duplicated across 6 command files
- **Location:** `src/commands/close-bidding.ts:153-155`, `src/commands/process-bid.ts:45-47`, `src/commands/process-approval.ts:62-64`, `src/commands/open-bidding.ts:57-59`, `src/commands/update-analytics.ts:101-103`, `src/commands/check-grace.ts:57-59`
- **Category:** Duplication
- **Risk:** LOW
- **Benefit:** MEDIUM
- **Status:** PENDING
- **Risk Rationale:** This is a purely internal change — no exported interfaces change, no public API modifications. Each command file's function signature remains identical. The change is mechanical: replace 3 identical lines with 1 import + 1 function call. All 6 files already have extensive test coverage (5 test files with env setup/teardown). The `src/lib/` directory already exists with other utilities (`github-api.ts`, `validation.ts`, etc.) so the pattern is established. No behavioral changes occur — the logic is identical, just centralized.
- **Benefit Rationale:** Removes ~18 lines of exact duplication (3 lines × 6 files). Creates a single source of truth for how GitHub repo info is parsed from environment variables. If the env var names ever change, only one place needs updating. Improves readability by making each command file 3 lines shorter at a well-understood boilerplate location. Medium rather than High because the duplicated block is small (3 lines) and doesn't cause significant maintenance burden today.
- **Refactoring Approach:**
  1. Create `src/lib/github-env.ts` exporting `getGitHubRepoInfo(): { owner: string; repo: string }`
  2. The function reads `GITHUB_REPOSITORY_OWNER` and `GITHUB_REPOSITORY` from `process.env`, parses the repo name, and returns both values
  3. In each of the 6 command files, replace the 3-line block with: `const { owner, repo } = getGitHubRepoInfo();`
  4. Add a unit test for `getGitHubRepoInfo()` covering: normal case, missing owner, missing repo, repo with/without slash
  5. Verify all existing tests still pass unchanged (they test end-to-end behavior, not the parsing function directly)
