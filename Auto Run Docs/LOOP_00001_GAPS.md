---
type: analysis
title: Documentation Gaps - Loop 00001
created: 2026-02-05
tags:
  - documentation
  - coverage
  - gaps
related:
  - "[[LOOP_00001_DOC_REPORT]]"
  - "[[1_ANALYZE]]"
---

# Documentation Gaps - Loop 00001

## Summary
- **Total Gaps Found:** 116
- **By Type:** 63 Functions, 5 Classes, 33 Interfaces/Types, 15 Modules
- **By Visibility:** 45 Public API, 39 Internal API, 32 Utility

## Gap List

### GAP-001: BidMeErrorCode
- **File:** `src/lib/error-handler.ts`
- **Line:** 1
- **Type:** Type
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Union type with 18 error codes — each code needs explanation
  - Used across all error handling paths
- **Signature:**
  ```
  type BidMeErrorCode = "CONFIG_MISSING" | "CONFIG_INVALID" | ... | "UNKNOWN"
  ```
- **Documentation Needed:**
  - [x] Description
  - [ ] Member descriptions (each error code)

### GAP-002: BidMeError
- **File:** `src/lib/error-handler.ts`
- **Line:** 22
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Custom error class with retryable flag and context payload
  - Central error type for the entire application
- **Signature:**
  ```
  class BidMeError extends Error {
    constructor(message: string, code: BidMeErrorCode, options?: { retryable?: boolean; context?: Record<string, unknown>; cause?: unknown })
  }
  ```
- **Documentation Needed:**
  - [ ] Class description
  - [ ] Constructor parameters
  - [ ] Properties (code, context, retryable)
  - [ ] Examples

### GAP-003: logError
- **File:** `src/lib/error-handler.ts`
- **Line:** 40
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Handles multiple error types differently (BidMeError vs Error vs unknown)
  - Logging format with timestamps and context
- **Signature:**
  ```
  function logError(error: unknown, context: string): void
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Examples

### GAP-004: withRetry
- **File:** `src/lib/error-handler.ts`
- **Line:** 62
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Generic retry function with configurable delay and callback
  - Used across all GitHub API and Polar API calls
  - Throws the last error if all attempts fail
- **Signature:**
  ```
  async function withRetry<T>(fn: () => Promise<T>, maxAttempts?: number, options?: { delayMs?: number; onRetry?: (attempt: number, error: unknown) => void }): Promise<T>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling
  - [ ] Examples

### GAP-005: isRateLimited
- **File:** `src/lib/error-handler.ts`
- **Line:** 85
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Checks for HTTP 403/429 status codes on error objects
- **Signature:**
  ```
  function isRateLimited(error: unknown): boolean
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-006: formatNumber
- **File:** `src/lib/badge-generator.ts`
- **Line:** 1
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Formats numbers with k/M suffixes
- **Signature:**
  ```
  function formatNumber(n: number): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-007: generateViewsBadge
- **File:** `src/lib/badge-generator.ts`
- **Line:** 13
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Generates shields.io badge markdown
- **Signature:**
  ```
  function generateViewsBadge(count: number): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-008: generateCountriesBadge
- **File:** `src/lib/badge-generator.ts`
- **Line:** 19
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generateCountriesBadge(count: number): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-009: generateCTRBadge
- **File:** `src/lib/badge-generator.ts`
- **Line:** 25
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generateCTRBadge(rate: number): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-010: generateBannerSection
- **File:** `src/lib/badge-generator.ts`
- **Line:** 31
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Produces the README banner markdown with clickable image and badges
  - Used in close-bidding to update README
- **Signature:**
  ```
  function generateBannerSection(bannerUrl: string, destUrl: string, badges: string[]): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Examples

### GAP-011: ParsedBid
- **File:** `src/lib/validation.ts`
- **Line:** 3
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Core domain type representing a parsed bid from a comment
- **Signature:**
  ```
  interface ParsedBid { amount: number; banner_url: string; destination_url: string; contact: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-012: ValidationError
- **File:** `src/lib/validation.ts`
- **Line:** 10
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface ValidationError { field: string; message: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-013: ValidationResult
- **File:** `src/lib/validation.ts`
- **Line:** 15
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface ValidationResult { valid: boolean; errors: ValidationError[] }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-014: parseBidComment
- **File:** `src/lib/validation.ts`
- **Line:** 20
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Parses YAML code blocks from GitHub issue comments
  - Returns null on parse failure — non-obvious behavior
  - Critical bid processing pipeline entry point
- **Signature:**
  ```
  function parseBidComment(body: string): ParsedBid | null
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Examples
  - [ ] Error handling

### GAP-015: validateBid
- **File:** `src/lib/validation.ts`
- **Line:** 46
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Multi-field validation (amount, URLs, contact format)
  - Config-dependent rules (minimum bid, increment)
  - Returns structured validation errors
- **Signature:**
  ```
  function validateBid(bid: ParsedBid, config: BidMeConfig): ValidationResult
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Examples
  - [ ] Error handling

### GAP-016: validateBannerUrl
- **File:** `src/lib/validation.ts`
- **Line:** 109
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Async function that makes HTTP HEAD request to check URL
  - Validates format extensions against config
  - Network-dependent behavior
- **Signature:**
  ```
  async function validateBannerUrl(url: string, config: BidMeConfig): Promise<ValidationResult>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-017: DailyView
- **File:** `src/lib/analytics-store.ts`
- **Line:** 4
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface DailyView { date: string; count: number; uniques: number }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-018: ClickEvent
- **File:** `src/lib/analytics-store.ts`
- **Line:** 10
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface ClickEvent { banner_id: string; timestamp: string; referrer?: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-019: PeriodAnalytics
- **File:** `src/lib/analytics-store.ts`
- **Line:** 16
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PeriodAnalytics { period_id: string; views: number; clicks: number; ctr: number; start_date: string; end_date: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-020: AnalyticsData
- **File:** `src/lib/analytics-store.ts`
- **Line:** 25
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Main analytics data structure with nested types
  - Contains aggregate and time-series data
- **Signature:**
  ```
  interface AnalyticsData { totalViews: number; uniqueVisitors: number; dailyViews: DailyView[]; clicks: ClickEvent[]; countries: Record<string, number>; periods: PeriodAnalytics[]; lastUpdated: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties
  - [ ] Examples

### GAP-021: loadAnalytics
- **File:** `src/lib/analytics-store.ts`
- **Line:** 47
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Returns defaults if file missing or corrupted — non-obvious fallback
  - Uses Bun file API
- **Signature:**
  ```
  async function loadAnalytics(path?: string): Promise<AnalyticsData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-022: saveAnalytics
- **File:** `src/lib/analytics-store.ts`
- **Line:** 74
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async function saveAnalytics(data: AnalyticsData, path?: string): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-023: recordClick
- **File:** `src/lib/analytics-store.ts`
- **Line:** 83
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Returns a new AnalyticsData (immutable pattern) — non-obvious
- **Signature:**
  ```
  function recordClick(data: AnalyticsData, bannerId: string, timestamp: string, referrer?: string): AnalyticsData
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-024: getClickThroughRate
- **File:** `src/lib/analytics-store.ts`
- **Line:** 99
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getClickThroughRate(views: number, clicks: number): number
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-025: aggregateByPeriod
- **File:** `src/lib/analytics-store.ts`
- **Line:** 104
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function aggregateByPeriod(data: AnalyticsData, periodId: string): PeriodAnalytics | null
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-026: BidRecord
- **File:** `src/lib/types.ts`
- **Line:** 1
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Core domain type — bid lifecycle status values need explanation
  - Status union ("pending" | "approved" | "rejected" | "unlinked_pending" | "expired") is non-obvious
- **Signature:**
  ```
  interface BidRecord { bidder: string; amount: number; banner_url: string; destination_url: string; contact: string; status: "pending" | "approved" | "rejected" | "unlinked_pending" | "expired"; comment_id: number; timestamp: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties (especially status values)
  - [ ] Examples

### GAP-027: PeriodData
- **File:** `src/lib/types.ts`
- **Line:** 12
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Complex nested type with optional payment sub-object
  - Core data structure for bidding lifecycle
- **Signature:**
  ```
  interface PeriodData { period_id: string; status: "open" | "closed"; start_date: string; end_date: string; issue_number: number; issue_url: string; bids: BidRecord[]; created_at: string; issue_node_id?: string; payment?: { checkout_url: string; payment_status: "pending" | "paid" | "expired"; product_id?: string; checkout_id?: string } }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties
  - [ ] Examples

### GAP-028: BidderRecord
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 3
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface BidderRecord { github_username: string; payment_linked: boolean; payment_provider: string | null; linked_at: string | null; warned_at: string | null }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-029: BidderRegistry
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 11
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface BidderRegistry { bidders: Record<string, BidderRecord> }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-030: loadBidders
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 25
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Populates internal module cache — side effect
  - Returns empty registry if file missing
- **Signature:**
  ```
  async function loadBidders(targetDir?: string): Promise<BidderRegistry>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects (cache)

### GAP-031: saveBidders
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 39
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async function saveBidders(targetDir?: string): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-032: getBidder
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 47
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getBidder(username: string): BidderRecord | null
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-033: registerBidder
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 52
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Returns existing record if already registered (idempotent)
  - Creates cache if not loaded — side effect
- **Signature:**
  ```
  function registerBidder(username: string): BidderRecord
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects

### GAP-034: markPaymentLinked
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 70
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Mutates cache in-place — side effect
  - Auto-registers bidder if not found
- **Signature:**
  ```
  function markPaymentLinked(username: string, provider: string): void
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Side effects

### GAP-035: isPaymentLinked
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 83
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function isPaymentLinked(username: string): boolean
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-036: getGraceDeadline
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 89
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Returns null if no warned_at timestamp — non-obvious
  - Calculates deadline from warned_at + grace hours
- **Signature:**
  ```
  function getGraceDeadline(username: string, graceHours: number): Date | null
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-037: setWarnedAt
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 97
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function setWarnedAt(username: string, timestamp?: string): void
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-038: resetRegistryCache
- **File:** `src/lib/bidder-registry.ts`
- **Line:** 108
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Testing utility — clears module-level cache
- **Signature:**
  ```
  function resetRegistryCache(): void
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-039: GitHubErrorResponse
- **File:** `src/lib/github-api.ts`
- **Line:** 1
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface GitHubErrorResponse { message: string; status: number; documentation_url?: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-040: GitHubAPIError
- **File:** `src/lib/github-api.ts`
- **Line:** 7
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  class GitHubAPIError extends Error { status: number; documentation_url?: string; constructor(response: GitHubErrorResponse) }
  ```
- **Documentation Needed:**
  - [ ] Class description
  - [ ] Properties
  - [ ] Constructor parameters

### GAP-041: GitHubAPI
- **File:** `src/lib/github-api.ts`
- **Line:** 46
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Primary external integration point — 15 public methods
  - Uses both REST and GraphQL APIs
  - Requires GITHUB_TOKEN env var
  - All methods can throw GitHubAPIError
- **Signature:**
  ```
  class GitHubAPI { constructor(owner: string, repo: string, token?: string) }
  ```
- **Documentation Needed:**
  - [ ] Class description
  - [ ] Constructor parameters
  - [ ] All public method docs (15 methods)
  - [ ] Error handling
  - [ ] Examples

### GAP-042: GitHubAPI.createIssue
- **File:** `src/lib/github-api.ts`
- **Line:** 104
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async createIssue(title: string, body: string, labels?: string[]): Promise<IssueData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-043: GitHubAPI.getIssue
- **File:** `src/lib/github-api.ts`
- **Line:** 116
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getIssue(issueNumber: number): Promise<IssueData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-044: GitHubAPI.updateIssueBody
- **File:** `src/lib/github-api.ts`
- **Line:** 120
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async updateIssueBody(issueNumber: number, body: string): Promise<IssueData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-045: GitHubAPI.closeIssue
- **File:** `src/lib/github-api.ts`
- **Line:** 129
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async closeIssue(issueNumber: number): Promise<IssueData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-046: GitHubAPI.pinIssue
- **File:** `src/lib/github-api.ts`
- **Line:** 135
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Uses GraphQL mutation (not REST) — non-obvious implementation
- **Signature:**
  ```
  async pinIssue(issueNodeId: string): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-047: GitHubAPI.unpinIssue
- **File:** `src/lib/github-api.ts`
- **Line:** 147
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async unpinIssue(issueNodeId: string): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-048: GitHubAPI.addComment
- **File:** `src/lib/github-api.ts`
- **Line:** 159
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async addComment(issueNumber: number, body: string): Promise<CommentData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-049: GitHubAPI.getComment
- **File:** `src/lib/github-api.ts`
- **Line:** 167
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getComment(commentId: number): Promise<CommentData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-050: GitHubAPI.updateComment
- **File:** `src/lib/github-api.ts`
- **Line:** 174
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async updateComment(commentId: number, body: string): Promise<CommentData>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-051: GitHubAPI.getComments
- **File:** `src/lib/github-api.ts`
- **Line:** 182
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getComments(issueNumber: number): Promise<CommentData[]>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-052: GitHubAPI.getReactions
- **File:** `src/lib/github-api.ts`
- **Line:** 189
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getReactions(commentId: number): Promise<ReactionData[]>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-053: GitHubAPI.getTrafficViews
- **File:** `src/lib/github-api.ts`
- **Line:** 196
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Returns complex inline type — needs documentation
  - Requires repo push access
- **Signature:**
  ```
  async getTrafficViews(): Promise<{ count: number; uniques: number; views: { timestamp: string; count: number; uniques: number }[] }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Return value

### GAP-054: GitHubAPI.getTrafficClones
- **File:** `src/lib/github-api.ts`
- **Line:** 204
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async getTrafficClones(): Promise<{ count: number; uniques: number; clones: { timestamp: string; count: number; uniques: number }[] }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Return value

### GAP-055: GitHubAPI.getPopularReferrers
- **File:** `src/lib/github-api.ts`
- **Line:** 212
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getPopularReferrers(): Promise<{ referrer: string; count: number; uniques: number }[]>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Return value

### GAP-056: GitHubAPI.dispatchEvent
- **File:** `src/lib/github-api.ts`
- **Line:** 218
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Triggers repository_dispatch event — non-obvious purpose
- **Signature:**
  ```
  async dispatchEvent(eventType: string, clientPayload: Record<string, unknown>): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-057: GitHubAPI.createPR
- **File:** `src/lib/github-api.ts`
- **Line:** 228
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async createPR(title: string, body: string, head: string, base: string): Promise<{ number: number; html_url: string; title: string; body: string; state: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-058: GitHubAPI.updatePRBody
- **File:** `src/lib/github-api.ts`
- **Line:** 242
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async updatePRBody(prNumber: number, body: string): Promise<{ number: number; html_url: string; ... }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-059: GitHubAPI.updateReadme
- **File:** `src/lib/github-api.ts`
- **Line:** 251
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Fetches existing README to get SHA before update
  - Uses base64 encoding
  - Creates a commit on the repo
- **Signature:**
  ```
  async updateReadme(content: string, message: string): Promise<CommitResponse>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-060: PaymentMode
- **File:** `src/lib/polar-integration.ts`
- **Line:** 1
- **Type:** Type
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  type PaymentMode = "polar-own" | "bidme-managed"
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Member descriptions

### GAP-061: PolarConfig
- **File:** `src/lib/polar-integration.ts`
- **Line:** 3
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PolarConfig { accessToken: string; baseUrl: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-062: PaymentLinkConfig
- **File:** `src/lib/polar-integration.ts`
- **Line:** 8
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PaymentLinkConfig { mode: PaymentMode; bidme_fee_percent: number; payment_link: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-063: PolarProduct
- **File:** `src/lib/polar-integration.ts`
- **Line:** 14
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PolarProduct { id: string; name: string; description: string; prices: Array<{...}>; created_at: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-064: PolarCheckoutSession
- **File:** `src/lib/polar-integration.ts`
- **Line:** 22
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Status values need explanation
- **Signature:**
  ```
  interface PolarCheckoutSession { id: string; url: string; status: "open" | "succeeded" | "expired"; amount: number; currency: string; product_id: string; customer_email: string; created_at: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-065: PolarErrorResponse
- **File:** `src/lib/polar-integration.ts`
- **Line:** 33
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PolarErrorResponse { detail: string; status: number }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-066: PolarAPIError
- **File:** `src/lib/polar-integration.ts`
- **Line:** 38
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  class PolarAPIError extends Error { status: number; constructor(response: PolarErrorResponse) }
  ```
- **Documentation Needed:**
  - [ ] Class description
  - [ ] Properties

### GAP-067: PolarAPI
- **File:** `src/lib/polar-integration.ts`
- **Line:** 48
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Payment integration — critical path
  - Two modes (polar-own vs bidme-managed) with fallback behavior
  - Gracefully degrades when token missing
  - All methods can throw PolarAPIError
- **Signature:**
  ```
  class PolarAPI { constructor(accessToken?: string, mode?: PaymentMode) }
  ```
- **Documentation Needed:**
  - [ ] Class description
  - [ ] Constructor parameters
  - [ ] All public method docs (4 methods)
  - [ ] Error handling
  - [ ] Examples

### GAP-068: PolarAPI.createProduct
- **File:** `src/lib/polar-integration.ts`
- **Line:** 130
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Price is in dollars, converted to cents internally
- **Signature:**
  ```
  async createProduct(name: string, price: number, description: string): Promise<PolarProduct>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-069: PolarAPI.createCheckoutSession
- **File:** `src/lib/polar-integration.ts`
- **Line:** 148
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async createCheckoutSession(amount: number, bidderEmail: string, periodId: string): Promise<PolarCheckoutSession>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-070: PolarAPI.getPaymentStatus
- **File:** `src/lib/polar-integration.ts`
- **Line:** 161
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async getPaymentStatus(checkoutId: string): Promise<{ paid: boolean; status: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-071: PolarAPI.createPaymentLink
- **File:** `src/lib/polar-integration.ts`
- **Line:** 174
- **Type:** Method
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Falls back to config payment_link if Polar not configured
  - Both modes use same Polar checkout flow (for now)
- **Signature:**
  ```
  async createPaymentLink(bid: { bidder: string; amount: number; contact: string }, config: PaymentLinkConfig): Promise<string>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-072: BidMeConfig
- **File:** `src/lib/config.ts`
- **Line:** 4
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Central configuration interface used by every module
  - 7 nested sections with specific value constraints
- **Signature:**
  ```
  interface BidMeConfig { bidding: {...}; banner: {...}; approval: {...}; payment: {...}; enforcement: {...}; tracking: {...}; content_guidelines: {...} }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] All properties and sub-properties
  - [ ] Valid values and constraints
  - [ ] Examples

### GAP-073: DEFAULT_CONFIG
- **File:** `src/lib/config.ts`
- **Line:** 42
- **Type:** Const
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Default values and their rationale
- **Signature:**
  ```
  const DEFAULT_CONFIG: BidMeConfig
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Rationale for default values

### GAP-074: ConfigValidationError
- **File:** `src/lib/config.ts`
- **Line:** 103
- **Type:** Class
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  class ConfigValidationError extends Error { constructor(message: string) }
  ```
- **Documentation Needed:**
  - [ ] Class description

### GAP-075: validateConfig
- **File:** `src/lib/config.ts`
- **Line:** 110
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Deep merges with defaults before validation
  - Throws ConfigValidationError with specific messages
  - Validates all config sections
- **Signature:**
  ```
  function validateConfig(config: unknown): BidMeConfig
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling (@throws)

### GAP-076: loadConfig
- **File:** `src/lib/config.ts`
- **Line:** 195
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Reads TOML config file from .bidme/ directory
  - Returns defaults if file missing — non-obvious
- **Signature:**
  ```
  async function loadConfig(targetDir?: string): Promise<BidMeConfig>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-077: saveConfig
- **File:** `src/lib/config.ts`
- **Line:** 211
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  async function saveConfig(config: BidMeConfig, targetDir?: string): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters

### GAP-078: generateToml
- **File:** `src/lib/config.ts`
- **Line:** 221
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Manually constructs TOML with section comments
- **Signature:**
  ```
  function generateToml(config: BidMeConfig): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-079: parseToml
- **File:** `src/lib/config.ts`
- **Line:** 282
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function parseToml(tomlString: string): BidMeConfig
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-080: generateBidTable
- **File:** `src/lib/issue-template.ts`
- **Line:** 5
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Generates markdown table with emoji status indicators
  - Sorts bids by amount descending
- **Signature:**
  ```
  function generateBidTable(bids: BidRecord[]): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-081: generateCurrentTopBid
- **File:** `src/lib/issue-template.ts`
- **Line:** 34
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generateCurrentTopBid(bids: BidRecord[]): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-082: generateStatsSection
- **File:** `src/lib/issue-template.ts`
- **Line:** 47
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generateStatsSection(stats?: PeriodAnalytics): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-083: generatePreviousStatsSection
- **File:** `src/lib/issue-template.ts`
- **Line:** 61
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generatePreviousStatsSection(stats: PeriodAnalytics): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-084: generateBidIssueBody
- **File:** `src/lib/issue-template.ts`
- **Line:** 65
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Generates the full GitHub issue body with multiple sections
  - Calculates countdown from end date
  - Used in open-bidding
- **Signature:**
  ```
  function generateBidIssueBody(config: BidMeConfig, periodData: PeriodData, previousStats?: PeriodAnalytics): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-085: generateBiddingIssueBody
- **File:** `src/lib/issue-template.ts`
- **Line:** 133
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function generateBiddingIssueBody(period: PeriodData, config: BidMeConfig, bids: BidRecord[], previousStats?: PeriodAnalytics): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-086: generateWinnerAnnouncement
- **File:** `src/lib/issue-template.ts`
- **Line:** 143
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function generateWinnerAnnouncement(bid: BidRecord, period: PeriodData, checkoutUrl?: string): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-087: updateBidIssueBody
- **File:** `src/lib/issue-template.ts`
- **Line:** 172
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Uses regex replacement on existing issue body
  - Updates specific sections (top bid, bid table, stats)
- **Signature:**
  ```
  function updateBidIssueBody(existingBody: string, bids: BidRecord[], previousStats?: PeriodAnalytics): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-088: generateNoBidsMessage
- **File:** `src/lib/issue-template.ts`
- **Line:** 202
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function generateNoBidsMessage(period: PeriodData): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-089: validateBannerImage
- **File:** `src/lib/content-enforcer.ts`
- **Line:** 14
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Makes HTTP requests (HEAD + full fetch)
  - Checks MIME type, file size, and image dimensions
  - Reads binary image headers for dimension extraction
- **Signature:**
  ```
  async function validateBannerImage(url: string, config: BidMeConfig): Promise<ValidationResult>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Error handling

### GAP-090: validateCommentFormat
- **File:** `src/lib/content-enforcer.ts`
- **Line:** 141
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function validateCommentFormat(body: string): ValidationResult
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-091: checkProhibitedContent
- **File:** `src/lib/content-enforcer.ts`
- **Line:** 175
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function checkProhibitedContent(bid: ParsedBid, config: BidMeConfig): ValidationError[]
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-092: enforceContent
- **File:** `src/lib/content-enforcer.ts`
- **Line:** 200
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Orchestrates banner image validation + prohibited content check
  - Async — makes network requests
- **Signature:**
  ```
  async function enforceContent(bid: ParsedBid, config: BidMeConfig): Promise<{ passed: boolean; errors: string[] }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-093: ScaffoldResult
- **File:** `src/lib/scaffold.ts`
- **Line:** 5
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  interface ScaffoldResult { configCreated: boolean; dataFilesCreated: string[]; workflowsCopied: string[]; workflowsSkipped: string[]; redirectCopied: boolean; readmeUpdated: boolean; versionCreated: boolean; owner: string; repo: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-094: scaffold
- **File:** `src/lib/scaffold.ts`
- **Line:** 166
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Creates entire .bidme/ directory structure
  - Copies workflow templates, creates config, updates README
  - Auto-detects git repo owner/repo from .git/config
- **Signature:**
  ```
  async function scaffold(target: string, config: BidMeConfig): Promise<ScaffoldResult>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects (filesystem changes)

### GAP-095: Migration
- **File:** `src/lib/migrations/index.ts`
- **Line:** 1
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface Migration { version: string; description: string; migrate: (targetDir: string) => Promise<void> }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-096: migrations
- **File:** `src/lib/migrations/index.ts`
- **Line:** 9
- **Type:** Const
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  const migrations: Migration[]
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-097: getMigrationsAfter
- **File:** `src/lib/migrations/index.ts`
- **Line:** 13
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getMigrationsAfter(currentVersion: string): Migration[]
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-098: migrateConfig
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 19
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Migrates from YAML to TOML config format
  - Complex field mapping between formats
- **Signature:**
  ```
  async function migrateConfig(targetDir: string): Promise<boolean>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-099: migrateData
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 69
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Moves data files from old to new directory structure
  - Patches data schemas inline
- **Signature:**
  ```
  async function migrateData(targetDir: string): Promise<boolean>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-100: migrateWorkflows
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 149
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async function migrateWorkflows(targetDir: string): Promise<string[]>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-101: migrateReadme
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 196
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async function migrateReadme(targetDir: string): Promise<boolean>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-102: cleanupOldFiles
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 237
- **Type:** Function
- **Visibility:** INTERNAL API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Deletes old config and data directory — destructive
- **Signature:**
  ```
  async function cleanupOldFiles(targetDir: string): Promise<string[]>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-103: v020Migration
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Line:** 325
- **Type:** Const
- **Visibility:** INTERNAL API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  const v020Migration: Migration
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-104: OpenBiddingOptions
- **File:** `src/commands/open-bidding.ts`
- **Line:** 10
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface OpenBiddingOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-105: runOpenBidding
- **File:** `src/commands/open-bidding.ts`
- **Line:** 20
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - CLI command entry point — creates GitHub issue, pins it, saves period data
  - Requires GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY env vars
  - Gracefully degrades in local mode
- **Signature:**
  ```
  async function runOpenBidding(options?: OpenBiddingOptions): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Side effects
  - [ ] Environment variables

### GAP-106: ProcessBidOptions
- **File:** `src/commands/process-bid.ts`
- **Line:** 12
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface ProcessBidOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-107: runProcessBid
- **File:** `src/commands/process-bid.ts`
- **Line:** 16
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Full bid processing pipeline: fetch comment, parse, validate, enforce content, check payment, record bid
  - Posts feedback comments to GitHub issue
- **Signature:**
  ```
  async function runProcessBid(issueNumber: number, commentId: number, options?: ProcessBidOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects
  - [ ] Environment variables

### GAP-108: ProcessApprovalOptions
- **File:** `src/commands/process-approval.ts`
- **Line:** 9
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface ProcessApprovalOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-109: runProcessApproval
- **File:** `src/commands/process-approval.ts`
- **Line:** 13
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Checks owner emoji reactions to approve/reject bids
  - Updates issue body and posts confirmation comment
- **Signature:**
  ```
  async function runProcessApproval(issueNumber: number, commentId: number, options?: ProcessApprovalOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-110: CloseBiddingOptions
- **File:** `src/commands/close-bidding.ts`
- **Line:** 15
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface CloseBiddingOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-111: appendTrackingParams
- **File:** `src/commands/close-bidding.ts`
- **Line:** 19
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function appendTrackingParams(destinationUrl: string, owner: string, repo: string): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-112: runCloseBidding
- **File:** `src/commands/close-bidding.ts`
- **Line:** 103
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Selects winner, processes payment, updates README, archives period
  - Orchestrates GitHub API + Polar API calls
- **Signature:**
  ```
  async function runCloseBidding(options?: CloseBiddingOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects

### GAP-113: CheckGraceOptions
- **File:** `src/commands/check-grace.ts`
- **Line:** 14
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface CheckGraceOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-114: runCheckGrace
- **File:** `src/commands/check-grace.ts`
- **Line:** 18
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Checks grace period deadlines for unlinked bidders
  - Restores bids if payment linked, expires if deadline passed
  - Restores struck-through comments
- **Signature:**
  ```
  async function runCheckGrace(options?: CheckGraceOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Side effects

### GAP-115: UpdateAnalyticsOptions
- **File:** `src/commands/update-analytics.ts`
- **Line:** 15
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface UpdateAnalyticsOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-116: PreviousWeekStats
- **File:** `src/commands/update-analytics.ts`
- **Line:** 19
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface PreviousWeekStats { views: number; clicks: number; ctr: number }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-117: runUpdateAnalytics
- **File:** `src/commands/update-analytics.ts`
- **Line:** 91
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Fetches GitHub traffic API data, merges with existing analytics
  - Processes click events from GITHUB_EVENT_PATH
  - Recomputes period aggregates
- **Signature:**
  ```
  async function runUpdateAnalytics(options?: UpdateAnalyticsOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value
  - [ ] Environment variables

### GAP-118: mergeDailyViews
- **File:** `src/commands/update-analytics.ts`
- **Line:** 25
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** MODERATE
- **Current State:** No docs
- **Why It Needs Docs:**
  - Merge strategy: takes max of each metric per date
- **Signature:**
  ```
  function mergeDailyViews(existing: DailyView[], incoming: DailyView[]): DailyView[]
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-119: computePreviousWeekStats
- **File:** `src/commands/update-analytics.ts`
- **Line:** 45
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function computePreviousWeekStats(data: AnalyticsData): PreviousWeekStats
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-120: computePeriodAggregates
- **File:** `src/commands/update-analytics.ts`
- **Line:** 71
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function computePeriodAggregates(data: AnalyticsData, periods: PeriodAnalytics[]): PeriodAnalytics[]
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-121: DailyRecapOptions
- **File:** `src/commands/daily-recap.ts`
- **Line:** 8
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface DailyRecapOptions { target?: string }
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-122: runDailyRecap
- **File:** `src/commands/daily-recap.ts`
- **Line:** 54
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  async function runDailyRecap(options?: DailyRecapOptions): Promise<{ success: boolean; message: string }>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-123: getTodayViews
- **File:** `src/commands/daily-recap.ts`
- **Line:** 12
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getTodayViews(analytics: AnalyticsData): number
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-124: getTodayClicks
- **File:** `src/commands/daily-recap.ts`
- **Line:** 18
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getTodayClicks(analytics: AnalyticsData): number
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-125: formatRecap
- **File:** `src/commands/daily-recap.ts`
- **Line:** 23
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** MODERATE
- **Current State:** No docs
- **Signature:**
  ```
  function formatRecap(todayViews: number, todayClicks: number, activeBids: number, highestBid: number | null, totalViews: number, totalClicks: number): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-126: VersionInfo
- **File:** `src/commands/update.ts`
- **Line:** 4
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface VersionInfo { version: string; installed_at: string; last_updated: string }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-127: UpdateResult
- **File:** `src/commands/update.ts`
- **Line:** 10
- **Type:** Interface
- **Visibility:** PUBLIC API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface UpdateResult { success: boolean; alreadyUpToDate: boolean; migrationsRun: string[]; errors: string[] }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-128: runUpdate
- **File:** `src/commands/update.ts`
- **Line:** 56
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Detects legacy vs modern install, runs pending migrations
  - Updates version.json
- **Signature:**
  ```
  async function runUpdate(options: { target: string }): Promise<UpdateResult>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Return value

### GAP-129: InitOptions
- **File:** `src/commands/init.ts`
- **Line:** 5
- **Type:** Interface
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  interface InitOptions { target: string; useDefaults: boolean }
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Properties

### GAP-130: WizardConfig
- **File:** `src/commands/init.ts`
- **Line:** 10
- **Type:** Type
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  type WizardConfig = BidMeConfig
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-131: DEFAULT_WIZARD_CONFIG
- **File:** `src/commands/init.ts`
- **Line:** 12
- **Type:** Const
- **Visibility:** INTERNAL API
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  const DEFAULT_WIZARD_CONFIG: WizardConfig
  ```
- **Documentation Needed:**
  - [ ] Description

### GAP-132: collectConfig
- **File:** `src/commands/init.ts`
- **Line:** 20
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - Interactive wizard using @clack/prompts
  - Handles user cancellation
  - Returns fully populated BidMeConfig
- **Signature:**
  ```
  async function collectConfig(): Promise<WizardConfig>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Return value
  - [ ] Side effects (interactive prompts)

### GAP-133: runInit
- **File:** `src/commands/init.ts`
- **Line:** 173
- **Type:** Function
- **Visibility:** PUBLIC API
- **Complexity:** COMPLEX
- **Current State:** No docs
- **Why It Needs Docs:**
  - CLI command entry point — scaffolds entire .bidme/ directory
  - Supports --defaults flag for non-interactive mode
- **Signature:**
  ```
  async function runInit(options: InitOptions): Promise<void>
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Parameters
  - [ ] Side effects (filesystem, stdout)

### GAP-134: getVersion
- **File:** `src/cli.ts`
- **Line:** 10
- **Type:** Function
- **Visibility:** UTILITY
- **Complexity:** SIMPLE
- **Current State:** No docs
- **Signature:**
  ```
  function getVersion(): string
  ```
- **Documentation Needed:**
  - [ ] Description
  - [ ] Return value

---

## Gaps by Module

| Module | Gap Count | Types |
|--------|-----------|-------|
| `src/lib/github-api.ts` | 21 | 1 Interface, 2 Classes, 18 Methods |
| `src/lib/polar-integration.ts` | 12 | 5 Interfaces, 2 Classes, 5 Methods |
| `src/lib/analytics-store.ts` | 9 | 4 Interfaces, 5 Functions |
| `src/lib/bidder-registry.ts` | 11 | 2 Interfaces, 9 Functions |
| `src/lib/config.ts` | 8 | 1 Interface, 1 Class, 1 Const, 5 Functions |
| `src/lib/issue-template.ts` | 9 | 9 Functions |
| `src/lib/content-enforcer.ts` | 4 | 4 Functions |
| `src/lib/scaffold.ts` | 2 | 1 Interface, 1 Function |
| `src/lib/validation.ts` | 6 | 3 Interfaces, 3 Functions |
| `src/lib/types.ts` | 2 | 2 Interfaces |
| `src/lib/error-handler.ts` | 5 | 1 Type, 1 Class, 3 Functions |
| `src/lib/badge-generator.ts` | 5 | 5 Functions |
| `src/lib/migrations/index.ts` | 3 | 1 Interface, 1 Const, 1 Function |
| `src/lib/migrations/v0.2.0.ts` | 6 | 5 Functions, 1 Const |
| `src/commands/open-bidding.ts` | 2 | 1 Interface, 1 Function |
| `src/commands/process-bid.ts` | 2 | 1 Interface, 1 Function |
| `src/commands/process-approval.ts` | 2 | 1 Interface, 1 Function |
| `src/commands/close-bidding.ts` | 3 | 1 Interface, 2 Functions |
| `src/commands/check-grace.ts` | 2 | 1 Interface, 1 Function |
| `src/commands/update-analytics.ts` | 6 | 2 Interfaces, 4 Functions |
| `src/commands/daily-recap.ts` | 5 | 1 Interface, 4 Functions |
| `src/commands/update.ts` | 3 | 2 Interfaces, 1 Function |
| `src/commands/init.ts` | 5 | 1 Interface, 1 Type, 1 Const, 2 Functions |
| `src/cli.ts` | 1 | 1 Function |

## Gaps by Type

### Functions
| Name | File | Visibility | Complexity |
|------|------|------------|------------|
| `logError` | `src/lib/error-handler.ts` | PUBLIC API | MODERATE |
| `withRetry` | `src/lib/error-handler.ts` | PUBLIC API | COMPLEX |
| `isRateLimited` | `src/lib/error-handler.ts` | PUBLIC API | SIMPLE |
| `formatNumber` | `src/lib/badge-generator.ts` | UTILITY | SIMPLE |
| `generateViewsBadge` | `src/lib/badge-generator.ts` | INTERNAL API | SIMPLE |
| `generateCountriesBadge` | `src/lib/badge-generator.ts` | INTERNAL API | SIMPLE |
| `generateCTRBadge` | `src/lib/badge-generator.ts` | INTERNAL API | SIMPLE |
| `generateBannerSection` | `src/lib/badge-generator.ts` | PUBLIC API | MODERATE |
| `parseBidComment` | `src/lib/validation.ts` | PUBLIC API | COMPLEX |
| `validateBid` | `src/lib/validation.ts` | PUBLIC API | COMPLEX |
| `validateBannerUrl` | `src/lib/validation.ts` | PUBLIC API | COMPLEX |
| `loadAnalytics` | `src/lib/analytics-store.ts` | PUBLIC API | MODERATE |
| `saveAnalytics` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `recordClick` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `getClickThroughRate` | `src/lib/analytics-store.ts` | UTILITY | SIMPLE |
| `aggregateByPeriod` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `loadBidders` | `src/lib/bidder-registry.ts` | PUBLIC API | MODERATE |
| `saveBidders` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `getBidder` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `registerBidder` | `src/lib/bidder-registry.ts` | PUBLIC API | MODERATE |
| `markPaymentLinked` | `src/lib/bidder-registry.ts` | PUBLIC API | MODERATE |
| `isPaymentLinked` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `getGraceDeadline` | `src/lib/bidder-registry.ts` | PUBLIC API | MODERATE |
| `setWarnedAt` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `resetRegistryCache` | `src/lib/bidder-registry.ts` | INTERNAL API | SIMPLE |
| `validateConfig` | `src/lib/config.ts` | PUBLIC API | COMPLEX |
| `loadConfig` | `src/lib/config.ts` | PUBLIC API | MODERATE |
| `saveConfig` | `src/lib/config.ts` | PUBLIC API | SIMPLE |
| `generateToml` | `src/lib/config.ts` | PUBLIC API | MODERATE |
| `parseToml` | `src/lib/config.ts` | PUBLIC API | SIMPLE |
| `generateBidTable` | `src/lib/issue-template.ts` | PUBLIC API | MODERATE |
| `generateCurrentTopBid` | `src/lib/issue-template.ts` | INTERNAL API | SIMPLE |
| `generateStatsSection` | `src/lib/issue-template.ts` | INTERNAL API | SIMPLE |
| `generatePreviousStatsSection` | `src/lib/issue-template.ts` | INTERNAL API | SIMPLE |
| `generateBidIssueBody` | `src/lib/issue-template.ts` | PUBLIC API | COMPLEX |
| `generateBiddingIssueBody` | `src/lib/issue-template.ts` | PUBLIC API | MODERATE |
| `generateWinnerAnnouncement` | `src/lib/issue-template.ts` | PUBLIC API | MODERATE |
| `updateBidIssueBody` | `src/lib/issue-template.ts` | PUBLIC API | COMPLEX |
| `generateNoBidsMessage` | `src/lib/issue-template.ts` | PUBLIC API | SIMPLE |
| `validateBannerImage` | `src/lib/content-enforcer.ts` | PUBLIC API | COMPLEX |
| `validateCommentFormat` | `src/lib/content-enforcer.ts` | PUBLIC API | MODERATE |
| `checkProhibitedContent` | `src/lib/content-enforcer.ts` | PUBLIC API | MODERATE |
| `enforceContent` | `src/lib/content-enforcer.ts` | PUBLIC API | COMPLEX |
| `scaffold` | `src/lib/scaffold.ts` | PUBLIC API | COMPLEX |
| `getMigrationsAfter` | `src/lib/migrations/index.ts` | PUBLIC API | SIMPLE |
| `migrateConfig` | `src/lib/migrations/v0.2.0.ts` | INTERNAL API | COMPLEX |
| `migrateData` | `src/lib/migrations/v0.2.0.ts` | INTERNAL API | COMPLEX |
| `migrateWorkflows` | `src/lib/migrations/v0.2.0.ts` | INTERNAL API | MODERATE |
| `migrateReadme` | `src/lib/migrations/v0.2.0.ts` | INTERNAL API | MODERATE |
| `cleanupOldFiles` | `src/lib/migrations/v0.2.0.ts` | INTERNAL API | MODERATE |
| `runOpenBidding` | `src/commands/open-bidding.ts` | PUBLIC API | COMPLEX |
| `runProcessBid` | `src/commands/process-bid.ts` | PUBLIC API | COMPLEX |
| `runProcessApproval` | `src/commands/process-approval.ts` | PUBLIC API | COMPLEX |
| `appendTrackingParams` | `src/commands/close-bidding.ts` | PUBLIC API | SIMPLE |
| `runCloseBidding` | `src/commands/close-bidding.ts` | PUBLIC API | COMPLEX |
| `runCheckGrace` | `src/commands/check-grace.ts` | PUBLIC API | COMPLEX |
| `runUpdateAnalytics` | `src/commands/update-analytics.ts` | PUBLIC API | COMPLEX |
| `mergeDailyViews` | `src/commands/update-analytics.ts` | UTILITY | MODERATE |
| `computePreviousWeekStats` | `src/commands/update-analytics.ts` | UTILITY | MODERATE |
| `computePeriodAggregates` | `src/commands/update-analytics.ts` | UTILITY | MODERATE |
| `runDailyRecap` | `src/commands/daily-recap.ts` | PUBLIC API | MODERATE |
| `getTodayViews` | `src/commands/daily-recap.ts` | UTILITY | SIMPLE |
| `getTodayClicks` | `src/commands/daily-recap.ts` | UTILITY | SIMPLE |
| `formatRecap` | `src/commands/daily-recap.ts` | UTILITY | MODERATE |
| `runUpdate` | `src/commands/update.ts` | PUBLIC API | COMPLEX |
| `collectConfig` | `src/commands/init.ts` | PUBLIC API | COMPLEX |
| `runInit` | `src/commands/init.ts` | PUBLIC API | COMPLEX |
| `getVersion` | `src/cli.ts` | UTILITY | SIMPLE |

### Classes
| Name | File | Visibility | Complexity |
|------|------|------------|------------|
| `BidMeError` | `src/lib/error-handler.ts` | PUBLIC API | COMPLEX |
| `GitHubAPIError` | `src/lib/github-api.ts` | PUBLIC API | MODERATE |
| `GitHubAPI` | `src/lib/github-api.ts` | PUBLIC API | COMPLEX |
| `PolarAPIError` | `src/lib/polar-integration.ts` | PUBLIC API | SIMPLE |
| `PolarAPI` | `src/lib/polar-integration.ts` | PUBLIC API | COMPLEX |
| `ConfigValidationError` | `src/lib/config.ts` | PUBLIC API | SIMPLE |

### Types/Interfaces
| Name | File | Visibility | Complexity |
|------|------|------------|------------|
| `BidMeErrorCode` | `src/lib/error-handler.ts` | PUBLIC API | MODERATE |
| `ParsedBid` | `src/lib/validation.ts` | PUBLIC API | SIMPLE |
| `ValidationError` | `src/lib/validation.ts` | PUBLIC API | SIMPLE |
| `ValidationResult` | `src/lib/validation.ts` | PUBLIC API | SIMPLE |
| `DailyView` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `ClickEvent` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `PeriodAnalytics` | `src/lib/analytics-store.ts` | PUBLIC API | SIMPLE |
| `AnalyticsData` | `src/lib/analytics-store.ts` | PUBLIC API | MODERATE |
| `BidRecord` | `src/lib/types.ts` | PUBLIC API | MODERATE |
| `PeriodData` | `src/lib/types.ts` | PUBLIC API | COMPLEX |
| `BidderRecord` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `BidderRegistry` | `src/lib/bidder-registry.ts` | PUBLIC API | SIMPLE |
| `GitHubErrorResponse` | `src/lib/github-api.ts` | PUBLIC API | SIMPLE |
| `PaymentMode` | `src/lib/polar-integration.ts` | PUBLIC API | SIMPLE |
| `PolarConfig` | `src/lib/polar-integration.ts` | INTERNAL API | SIMPLE |
| `PaymentLinkConfig` | `src/lib/polar-integration.ts` | PUBLIC API | SIMPLE |
| `PolarProduct` | `src/lib/polar-integration.ts` | PUBLIC API | SIMPLE |
| `PolarCheckoutSession` | `src/lib/polar-integration.ts` | PUBLIC API | MODERATE |
| `PolarErrorResponse` | `src/lib/polar-integration.ts` | PUBLIC API | SIMPLE |
| `BidMeConfig` | `src/lib/config.ts` | PUBLIC API | COMPLEX |
| `ScaffoldResult` | `src/lib/scaffold.ts` | PUBLIC API | MODERATE |
| `Migration` | `src/lib/migrations/index.ts` | PUBLIC API | SIMPLE |
| `OpenBiddingOptions` | `src/commands/open-bidding.ts` | INTERNAL API | SIMPLE |
| `ProcessBidOptions` | `src/commands/process-bid.ts` | INTERNAL API | SIMPLE |
| `ProcessApprovalOptions` | `src/commands/process-approval.ts` | INTERNAL API | SIMPLE |
| `CloseBiddingOptions` | `src/commands/close-bidding.ts` | INTERNAL API | SIMPLE |
| `CheckGraceOptions` | `src/commands/check-grace.ts` | INTERNAL API | SIMPLE |
| `UpdateAnalyticsOptions` | `src/commands/update-analytics.ts` | INTERNAL API | SIMPLE |
| `PreviousWeekStats` | `src/commands/update-analytics.ts` | INTERNAL API | SIMPLE |
| `DailyRecapOptions` | `src/commands/daily-recap.ts` | INTERNAL API | SIMPLE |
| `VersionInfo` | `src/commands/update.ts` | INTERNAL API | SIMPLE |
| `UpdateResult` | `src/commands/update.ts` | PUBLIC API | SIMPLE |
| `InitOptions` | `src/commands/init.ts` | INTERNAL API | SIMPLE |
| `WizardConfig` | `src/commands/init.ts` | INTERNAL API | SIMPLE |

## Related Exports

Exports that should be documented together:

- **Group A:** `BidMeConfig`, `DEFAULT_CONFIG`, `validateConfig`, `loadConfig`, `saveConfig`, `generateToml`, `parseToml`, `ConfigValidationError` — Configuration lifecycle
- **Group B:** `BidRecord`, `PeriodData` — Core domain types used everywhere
- **Group C:** `parseBidComment`, `validateBid`, `validateBannerUrl`, `ParsedBid`, `ValidationError`, `ValidationResult` — Bid validation pipeline
- **Group D:** `GitHubAPI` + all methods, `GitHubAPIError`, `GitHubErrorResponse` — GitHub integration
- **Group E:** `PolarAPI` + all methods, `PolarAPIError`, `PaymentMode`, `PolarConfig`, `PaymentLinkConfig` — Payment integration
- **Group F:** `loadBidders`, `saveBidders`, `getBidder`, `registerBidder`, `markPaymentLinked`, `isPaymentLinked`, `getGraceDeadline`, `setWarnedAt`, `BidderRecord`, `BidderRegistry` — Bidder registry lifecycle
- **Group G:** `loadAnalytics`, `saveAnalytics`, `recordClick`, `getClickThroughRate`, `aggregateByPeriod`, `AnalyticsData`, `DailyView`, `ClickEvent`, `PeriodAnalytics` — Analytics store
- **Group H:** `validateBannerImage`, `validateCommentFormat`, `checkProhibitedContent`, `enforceContent` — Content enforcement pipeline
- **Group I:** `generateBidTable`, `generateBidIssueBody`, `generateBiddingIssueBody`, `generateWinnerAnnouncement`, `updateBidIssueBody`, `generateNoBidsMessage` — Issue template generation
- **Group J:** All `run*` command functions — CLI command entry points
