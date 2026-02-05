---
type: report
title: Documentation Coverage Report - Loop 00001
created: 2026-02-05
tags:
  - documentation
  - coverage
  - analysis
related:
  - "[[1_ANALYZE]]"
  - "[[BidMe-Plan]]"
---

# Documentation Coverage Report - Loop 00001

## Summary
- **Overall Coverage:** 0.0%
- **Target:** 90%
- **Gap to Target:** 90.0%
- **Documentation Style:** None established — no doc comments exist in the codebase

## Coverage by Category

| Category | Documented | Total | Coverage |
|----------|------------|-------|----------|
| Functions | 0 | 63 | 0% |
| Classes | 0 | 5 | 0% |
| Interfaces/Types | 0 | 33 | 0% |
| Modules | 0 | 15 | 0% |
| **Total** | **0** | **116** | **0%** |

## Coverage by Module/Directory

| Module | Documented | Total | Coverage | Status |
|--------|------------|-------|----------|--------|
| src/cli.ts | 0 | 1 | 0% | NEEDS WORK |
| src/lib/error-handler.ts | 0 | 6 | 0% | NEEDS WORK |
| src/lib/badge-generator.ts | 0 | 5 | 0% | NEEDS WORK |
| src/lib/validation.ts | 0 | 6 | 0% | NEEDS WORK |
| src/lib/analytics-store.ts | 0 | 11 | 0% | NEEDS WORK |
| src/lib/types.ts | 0 | 2 | 0% | NEEDS WORK |
| src/lib/bidder-registry.ts | 0 | 11 | 0% | NEEDS WORK |
| src/lib/github-api.ts | 0 | 21 | 0% | NEEDS WORK |
| src/lib/polar-integration.ts | 0 | 12 | 0% | NEEDS WORK |
| src/lib/config.ts | 0 | 10 | 0% | NEEDS WORK |
| src/lib/issue-template.ts | 0 | 10 | 0% | NEEDS WORK |
| src/lib/content-enforcer.ts | 0 | 6 | 0% | NEEDS WORK |
| src/lib/scaffold.ts | 0 | 8 | 0% | NEEDS WORK |
| src/lib/migrations/index.ts | 0 | 3 | 0% | NEEDS WORK |
| src/lib/migrations/v0.2.0.ts | 0 | 10 | 0% | NEEDS WORK |
| src/commands/open-bidding.ts | 0 | 3 | 0% | NEEDS WORK |
| src/commands/process-bid.ts | 0 | 2 | 0% | NEEDS WORK |
| src/commands/process-approval.ts | 0 | 2 | 0% | NEEDS WORK |
| src/commands/close-bidding.ts | 0 | 5 | 0% | NEEDS WORK |
| src/commands/check-grace.ts | 0 | 2 | 0% | NEEDS WORK |
| src/commands/update-analytics.ts | 0 | 7 | 0% | NEEDS WORK |
| src/commands/daily-recap.ts | 0 | 5 | 0% | NEEDS WORK |
| src/commands/update.ts | 0 | 6 | 0% | NEEDS WORK |
| src/commands/init.ts | 0 | 5 | 0% | NEEDS WORK |

## Detailed Export Inventory

### src/cli.ts (1 export)
| Export | Kind | Documented |
|--------|------|------------|
| `getVersion` (local) | function | No |

### src/lib/error-handler.ts (6 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `BidMeErrorCode` | type | No |
| `BidMeError` | class | No |
| `logError` | function | No |
| `withRetry` | function | No |
| `isRateLimited` | function | No |

### src/lib/badge-generator.ts (5 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `formatNumber` | function | No |
| `generateViewsBadge` | function | No |
| `generateCountriesBadge` | function | No |
| `generateCTRBadge` | function | No |
| `generateBannerSection` | function | No |

### src/lib/validation.ts (6 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `ParsedBid` | interface | No |
| `ValidationError` | interface | No |
| `ValidationResult` | interface | No |
| `parseBidComment` | function | No |
| `validateBid` | function | No |
| `validateBannerUrl` | function | No |

### src/lib/analytics-store.ts (11 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `DailyView` | interface | No |
| `ClickEvent` | interface | No |
| `PeriodAnalytics` | interface | No |
| `AnalyticsData` | interface | No |
| `loadAnalytics` | function | No |
| `saveAnalytics` | function | No |
| `recordClick` | function | No |
| `getClickThroughRate` | function | No |
| `aggregateByPeriod` | function | No |
| `DEFAULT_ANALYTICS` (const, not exported directly) | const | No |
| `DEFAULT_PATH` (const, not exported directly) | const | No |

### src/lib/types.ts (2 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `BidRecord` | interface | No |
| `PeriodData` | interface | No |

### src/lib/bidder-registry.ts (11 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `BidderRecord` | interface | No |
| `BidderRegistry` | interface | No |
| `loadBidders` | function | No |
| `saveBidders` | function | No |
| `getBidder` | function | No |
| `registerBidder` | function | No |
| `markPaymentLinked` | function | No |
| `isPaymentLinked` | function | No |
| `getGraceDeadline` | function | No |
| `setWarnedAt` | function | No |
| `resetRegistryCache` | function | No |

### src/lib/github-api.ts (21 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `GitHubErrorResponse` | interface | No |
| `GitHubAPIError` | class | No |
| `IssueData` (non-exported) | interface | No |
| `CommentData` (non-exported) | interface | No |
| `ReactionData` (non-exported) | interface | No |
| `CommitResponse` (non-exported) | interface | No |
| `GitHubAPI` | class | No |
| `GitHubAPI.createIssue` | method | No |
| `GitHubAPI.getIssue` | method | No |
| `GitHubAPI.updateIssueBody` | method | No |
| `GitHubAPI.closeIssue` | method | No |
| `GitHubAPI.pinIssue` | method | No |
| `GitHubAPI.unpinIssue` | method | No |
| `GitHubAPI.addComment` | method | No |
| `GitHubAPI.getComment` | method | No |
| `GitHubAPI.updateComment` | method | No |
| `GitHubAPI.getComments` | method | No |
| `GitHubAPI.getReactions` | method | No |
| `GitHubAPI.getTrafficViews` | method | No |
| `GitHubAPI.getTrafficClones` | method | No |
| `GitHubAPI.getPopularReferrers` | method | No |
| `GitHubAPI.dispatchEvent` | method | No |
| `GitHubAPI.createPR` | method | No |
| `GitHubAPI.updatePRBody` | method | No |
| `GitHubAPI.updateReadme` | method | No |

### src/lib/polar-integration.ts (12 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `PaymentMode` | type | No |
| `PolarConfig` | interface | No |
| `PaymentLinkConfig` | interface | No |
| `PolarProduct` | interface | No |
| `PolarCheckoutSession` | interface | No |
| `PolarErrorResponse` | interface | No |
| `PolarAPIError` | class | No |
| `PolarAPI` | class | No |
| `PolarAPI.createProduct` | method | No |
| `PolarAPI.createCheckoutSession` | method | No |
| `PolarAPI.getPaymentStatus` | method | No |
| `PolarAPI.createPaymentLink` | method | No |

### src/lib/config.ts (10 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `BidMeConfig` | interface | No |
| `DEFAULT_CONFIG` | const | No |
| `ConfigValidationError` | class | No |
| `validateConfig` | function | No |
| `loadConfig` | function | No |
| `saveConfig` | function | No |
| `generateToml` | function | No |
| `parseToml` | function | No |
| `deepMerge` (non-exported) | function | No |

### src/lib/issue-template.ts (10 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `generateBidTable` | function | No |
| `generateCurrentTopBid` | function | No |
| `generateStatsSection` | function | No |
| `generatePreviousStatsSection` | function | No |
| `generateBidIssueBody` | function | No |
| `generateBiddingIssueBody` | function | No |
| `generateWinnerAnnouncement` | function | No |
| `updateBidIssueBody` | function | No |
| `generateNoBidsMessage` | function | No |

### src/lib/content-enforcer.ts (6 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `validateBannerImage` | function | No |
| `readImageDimensions` (non-exported) | function | No |
| `validateCommentFormat` | function | No |
| `checkProhibitedContent` | function | No |
| `enforceContent` | function | No |
| `FORMAT_TO_MIME` (const, non-exported) | const | No |

### src/lib/scaffold.ts (8 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `ScaffoldResult` | interface | No |
| `scaffold` | function | No |
| `bannerPlaceholder` (non-exported) | function | No |
| `detectGitRepo` (non-exported) | function | No |
| `ensureDir` (non-exported) | function | No |
| `writeIfNotExists` (non-exported) | function | No |
| `copyRedirectPage` (non-exported) | function | No |
| `copyWorkflowTemplates` (non-exported) | function | No |
| `updateReadme` (non-exported) | function | No |

### src/lib/migrations/index.ts (3 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `Migration` | interface | No |
| `migrations` | const | No |
| `getMigrationsAfter` | function | No |

### src/lib/migrations/v0.2.0.ts (10 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `migrateConfig` | function | No |
| `migrateData` | function | No |
| `migrateWorkflows` | function | No |
| `migrateReadme` | function | No |
| `cleanupOldFiles` | function | No |
| `v020Migration` | const | No |
| `parseSimpleYaml` (non-exported) | function | No |
| `parseYamlValue` (non-exported) | function | No |
| `fileExists` (non-exported) | function | No |
| `ensureDir` (non-exported) | function | No |

### src/commands/open-bidding.ts (3 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `OpenBiddingOptions` | interface | No |
| `runOpenBidding` | function | No |
| `formatDateRange` (non-exported) | function | No |

### src/commands/process-bid.ts (2 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `ProcessBidOptions` | interface | No |
| `runProcessBid` | function | No |

### src/commands/process-approval.ts (2 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `ProcessApprovalOptions` | interface | No |
| `runProcessApproval` | function | No |

### src/commands/close-bidding.ts (5 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `CloseBiddingOptions` | interface | No |
| `appendTrackingParams` | function | No |
| `runCloseBidding` | function | No |
| `processPayment` (non-exported) | function | No |
| `archivePeriod` (non-exported) | function | No |

### src/commands/check-grace.ts (2 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `CheckGraceOptions` | interface | No |
| `runCheckGrace` | function | No |

### src/commands/update-analytics.ts (7 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `UpdateAnalyticsOptions` | interface | No |
| `PreviousWeekStats` | interface | No |
| `runUpdateAnalytics` | function | No |
| `computePreviousWeekStats` | function | No |
| `mergeDailyViews` | function | No |
| `computePeriodAggregates` | function | No |

### src/commands/daily-recap.ts (5 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `DailyRecapOptions` | interface | No |
| `runDailyRecap` | function | No |
| `getTodayViews` | function | No |
| `getTodayClicks` | function | No |
| `formatRecap` | function | No |

### src/commands/update.ts (6 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `VersionInfo` | interface | No |
| `UpdateResult` | interface | No |
| `runUpdate` | function | No |
| `getPackageVersion` (non-exported) | function | No |
| `loadVersionInfo` (non-exported) | function | No |
| `saveVersionInfo` (non-exported) | function | No |
| `detectLegacyInstall` (non-exported) | function | No |

### src/commands/init.ts (5 exports)
| Export | Kind | Documented |
|--------|------|------------|
| `InitOptions` | interface | No |
| `WizardConfig` | type | No |
| `DEFAULT_WIZARD_CONFIG` | const | No |
| `collectConfig` | function | No |
| `runInit` | function | No |
| `validatePositiveInt` (non-exported) | function | No |

## Lowest Coverage Areas

All modules are at 0% coverage. The entire codebase has zero doc comments.

1. **src/lib/github-api.ts** — 0% coverage
   - 21 undocumented exports (largest file)
   - Key exports: `GitHubAPI` class, all API methods

2. **src/lib/polar-integration.ts** — 0% coverage
   - 12 undocumented exports
   - Key exports: `PolarAPI` class, payment methods

3. **src/lib/analytics-store.ts** — 0% coverage
   - 11 undocumented exports
   - Key exports: `loadAnalytics`, `saveAnalytics`, interfaces

4. **src/lib/bidder-registry.ts** — 0% coverage
   - 11 undocumented exports
   - Key exports: `loadBidders`, `registerBidder`, `markPaymentLinked`

5. **src/lib/config.ts** — 0% coverage
   - 10 undocumented exports
   - Key exports: `BidMeConfig`, `loadConfig`, `validateConfig`

## Existing Documentation Patterns

### Style Guide Observations
- **Comment style:** No doc comment convention established
- **Parameter format:** Not used
- **Return format:** Not used
- **Example usage:** Absent
- **Inline comments:** Sparse — only a few `// TODO` and mode-explanation comments in `polar-integration.ts`

### Common Patterns Found
- TypeScript interfaces are self-descriptive via property names but lack purpose descriptions
- Functions are named descriptively (e.g., `parseBidComment`, `validateBid`) but have no JSDoc
- Classes (`GitHubAPI`, `PolarAPI`, `BidMeError`) have no class-level or method-level documentation
- No module-level header comments or README files per module
- The CLI command descriptions (in `cli.ts`) are the only form of documentation via Commander's `.description()` strings

### Recommended Doc Style
Given this is a TypeScript/Bun project, **TSDoc/JSDoc** format would be the appropriate convention:
```typescript
/**
 * Brief description of the function.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When error occurs
 */
```

## High-Value Documentation Targets

### Quick Wins (Easy to document, high visibility)
1. `BidMeConfig` in `src/lib/config.ts` — central config interface, self-documenting fields benefit from purpose descriptions
2. `BidRecord` / `PeriodData` in `src/lib/types.ts` — core domain types used everywhere
3. `ParsedBid` / `ValidationResult` in `src/lib/validation.ts` — small, well-defined interfaces
4. `DEFAULT_CONFIG` in `src/lib/config.ts` — explains default values and their rationale

### High Priority (Heavily used, undocumented)
1. `GitHubAPI` class in `src/lib/github-api.ts` — 15 public methods, core integration point
2. `PolarAPI` class in `src/lib/polar-integration.ts` — payment integration, critical path
3. `loadConfig` / `validateConfig` in `src/lib/config.ts` — used by every command
4. `parseBidComment` / `validateBid` in `src/lib/validation.ts` — bid processing pipeline
5. `loadBidders` / `registerBidder` / `markPaymentLinked` in `src/lib/bidder-registry.ts` — bidder lifecycle
6. `enforceContent` / `validateBannerImage` in `src/lib/content-enforcer.ts` — content safety pipeline
7. Command functions (`runOpenBidding`, `runProcessBid`, etc.) — entry points for CLI operations

### Skip for Now (Low priority)
1. `formatNumber` in `src/lib/badge-generator.ts` — trivial utility, self-evident
2. `WORKFLOW_RENAMES` const in `src/lib/migrations/v0.2.0.ts` — migration-specific, rarely referenced
3. `parseSimpleYaml` / `parseYamlValue` in `src/lib/migrations/v0.2.0.ts` — internal migration helpers
