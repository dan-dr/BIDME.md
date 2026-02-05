---
type: analysis
title: Documentation Plan - Loop 00001
created: 2026-02-05
tags:
  - documentation
  - coverage
  - plan
related:
  - "[[LOOP_00001_GAPS]]"
  - "[[3_EVALUATE]]"
  - "[[4_IMPLEMENT]]"
---

# Documentation Plan - Loop 00001

## Summary
- **Total Gaps:** 134
- **Auto-Document (PENDING):** 68
- **Needs Context:** 0
- **Won't Do:** 66

## Current Coverage: 0%
## Target Coverage: 90%
## Estimated Post-Loop Coverage: 50.7% (68/134 gaps documented)

---

## PENDING - Ready for Auto-Documentation

### DOC-001: BidMeErrorCode
- **Status:** `PENDING`
- **File:** `src/lib/error-handler.ts`
- **Gap ID:** GAP-001
- **Type:** Type
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  type BidMeErrorCode = "CONFIG_MISSING" | "CONFIG_INVALID" | ... | "UNKNOWN"
  ```
- **Documentation Plan:**
  - [ ] Description: Union type of all error codes in BidMe
  - [ ] Member descriptions (each error code)
  - [ ] Examples: No

### DOC-002: BidMeError
- **Status:** `PENDING`
- **File:** `src/lib/error-handler.ts`
- **Gap ID:** GAP-002
- **Type:** Class
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  class BidMeError extends Error { constructor(message, code, options?) }
  ```
- **Documentation Plan:**
  - [ ] Description: Custom error class with retryable flag and context payload
  - [ ] Constructor parameters
  - [ ] Properties (code, context, retryable)
  - [ ] Examples: Yes
  - [ ] Errors: N/A (is the error type)

### DOC-003: logError
- **Status:** `PENDING`
- **File:** `src/lib/error-handler.ts`
- **Gap ID:** GAP-003
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function logError(error: unknown, context: string): void
  ```
- **Documentation Plan:**
  - [ ] Description: Logs errors with timestamps, handles BidMeError vs Error vs unknown
  - [ ] Parameters: error, context
  - [ ] Returns: void
  - [ ] Examples: Yes

### DOC-004: withRetry
- **Status:** `PENDING`
- **File:** `src/lib/error-handler.ts`
- **Gap ID:** GAP-004
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function withRetry<T>(fn, maxAttempts?, options?): Promise<T>
  ```
- **Documentation Plan:**
  - [ ] Description: Generic retry with configurable delay and callback
  - [ ] Parameters: fn, maxAttempts, options (delayMs, onRetry)
  - [ ] Returns: Promise<T>
  - [ ] Error handling: Throws last error after all attempts fail
  - [ ] Examples: Yes

### DOC-005: isRateLimited
- **Status:** `PENDING`
- **File:** `src/lib/error-handler.ts`
- **Gap ID:** GAP-005
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function isRateLimited(error: unknown): boolean
  ```
- **Documentation Plan:**
  - [ ] Description: Checks for HTTP 403/429 status codes
  - [ ] Parameters: error
  - [ ] Returns: boolean

### DOC-006: generateBannerSection
- **Status:** `PENDING`
- **File:** `src/lib/badge-generator.ts`
- **Gap ID:** GAP-010
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function generateBannerSection(bannerUrl, destUrl, badges): string
  ```
- **Documentation Plan:**
  - [ ] Description: Produces README banner markdown with clickable image and badges
  - [ ] Parameters: bannerUrl, destUrl, badges
  - [ ] Returns: Markdown string
  - [ ] Examples: Yes

### DOC-007: ParsedBid
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-011
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  interface ParsedBid { amount; banner_url; destination_url; contact }
  ```
- **Documentation Plan:**
  - [ ] Description: Core domain type — parsed bid from a GitHub comment
  - [ ] Properties: amount, banner_url, destination_url, contact

### DOC-008: ValidationError
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-012
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface ValidationError { field; message }
  ```
- **Documentation Plan:**
  - [ ] Description: Structured validation error with field and message
  - [ ] Properties: field, message

### DOC-009: ValidationResult
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-013
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface ValidationResult { valid; errors }
  ```
- **Documentation Plan:**
  - [ ] Description: Result of validation containing pass/fail and error list
  - [ ] Properties: valid, errors

### DOC-010: parseBidComment
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-014
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  function parseBidComment(body: string): ParsedBid | null
  ```
- **Documentation Plan:**
  - [ ] Description: Parses YAML code blocks from GitHub issue comments
  - [ ] Parameters: body
  - [ ] Returns: ParsedBid | null (null on parse failure)
  - [ ] Examples: Yes
  - [ ] Error handling: Returns null on failure

### DOC-011: validateBid
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-015
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  function validateBid(bid: ParsedBid, config: BidMeConfig): ValidationResult
  ```
- **Documentation Plan:**
  - [ ] Description: Multi-field validation with config-dependent rules
  - [ ] Parameters: bid, config
  - [ ] Returns: ValidationResult
  - [ ] Examples: Yes
  - [ ] Error handling: Returns structured errors

### DOC-012: validateBannerUrl
- **Status:** `PENDING`
- **File:** `src/lib/validation.ts`
- **Gap ID:** GAP-016
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function validateBannerUrl(url, config): Promise<ValidationResult>
  ```
- **Documentation Plan:**
  - [ ] Description: Async URL validation via HTTP HEAD request
  - [ ] Parameters: url, config
  - [ ] Returns: Promise<ValidationResult>
  - [ ] Error handling: Network errors

### DOC-013: AnalyticsData
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-020
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface AnalyticsData { totalViews; uniqueVisitors; dailyViews; clicks; countries; periods; lastUpdated }
  ```
- **Documentation Plan:**
  - [ ] Description: Main analytics data structure with aggregate and time-series data
  - [ ] Properties: all 7 properties
  - [ ] Examples: Yes

### DOC-014: DailyView
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-017
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface DailyView { date; count; uniques }
  ```
- **Documentation Plan:**
  - [ ] Description: Daily view count record
  - [ ] Properties: date, count, uniques

### DOC-015: ClickEvent
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-018
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface ClickEvent { banner_id; timestamp; referrer? }
  ```
- **Documentation Plan:**
  - [ ] Description: Banner click event record
  - [ ] Properties: banner_id, timestamp, referrer

### DOC-016: PeriodAnalytics
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-019
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface PeriodAnalytics { period_id; views; clicks; ctr; start_date; end_date }
  ```
- **Documentation Plan:**
  - [ ] Description: Aggregate analytics for a bidding period
  - [ ] Properties: all 6 properties

### DOC-017: loadAnalytics
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-021
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function loadAnalytics(path?): Promise<AnalyticsData>
  ```
- **Documentation Plan:**
  - [ ] Description: Loads analytics from JSON file, returns defaults if missing/corrupted
  - [ ] Parameters: path (optional)
  - [ ] Returns: Promise<AnalyticsData>
  - [ ] Error handling: Returns defaults on failure

### DOC-018: saveAnalytics
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-022
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function saveAnalytics(data, path?): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Persists analytics data to JSON file
  - [ ] Parameters: data, path

### DOC-019: recordClick
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-023
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function recordClick(data, bannerId, timestamp, referrer?): AnalyticsData
  ```
- **Documentation Plan:**
  - [ ] Description: Records a click event, returns new AnalyticsData (immutable)
  - [ ] Parameters: data, bannerId, timestamp, referrer
  - [ ] Returns: New AnalyticsData instance

### DOC-020: aggregateByPeriod
- **Status:** `PENDING`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-025
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function aggregateByPeriod(data, periodId): PeriodAnalytics | null
  ```
- **Documentation Plan:**
  - [ ] Description: Retrieves aggregated analytics for a specific period
  - [ ] Parameters: data, periodId
  - [ ] Returns: PeriodAnalytics | null

### DOC-021: BidRecord
- **Status:** `IMPLEMENTED`
- **Implemented In:** Loop 00001
- **File:** `src/lib/types.ts`
- **Gap ID:** GAP-026
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  interface BidRecord { bidder; amount; banner_url; destination_url; contact; status; comment_id; timestamp }
  ```
- **Documentation Added:**
  - [x] Description: Core domain type — bid lifecycle record
  - [x] Properties: all 8 properties with types and descriptions
  - [x] Status values: all 5 states documented (pending, approved, rejected, unlinked_pending, expired)
  - [x] Examples: Yes — full construction example

### DOC-022: PeriodData
- **Status:** `PENDING`
- **File:** `src/lib/types.ts`
- **Gap ID:** GAP-027
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  interface PeriodData { period_id; status; start_date; end_date; issue_number; issue_url; bids; created_at; issue_node_id?; payment? }
  ```
- **Documentation Plan:**
  - [ ] Description: Core data structure for bidding period lifecycle
  - [ ] Properties: all properties including nested payment object
  - [ ] Examples: Yes

### DOC-023: BidderRecord
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-028
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface BidderRecord { github_username; payment_linked; payment_provider; linked_at; warned_at }
  ```
- **Documentation Plan:**
  - [ ] Description: Bidder payment and warning state record
  - [ ] Properties: all 5 properties

### DOC-024: BidderRegistry
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-029
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface BidderRegistry { bidders: Record<string, BidderRecord> }
  ```
- **Documentation Plan:**
  - [ ] Description: Registry mapping usernames to bidder records
  - [ ] Properties: bidders

### DOC-025: loadBidders
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-030
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function loadBidders(targetDir?): Promise<BidderRegistry>
  ```
- **Documentation Plan:**
  - [ ] Description: Loads bidder registry from file, populates module cache
  - [ ] Parameters: targetDir
  - [ ] Returns: Promise<BidderRegistry>
  - [ ] Side effects: Populates internal cache

### DOC-026: saveBidders
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-031
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function saveBidders(targetDir?): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Persists cached bidder registry to file
  - [ ] Parameters: targetDir

### DOC-027: getBidder
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-032
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function getBidder(username): BidderRecord | null
  ```
- **Documentation Plan:**
  - [ ] Description: Retrieves a bidder record from cache by username
  - [ ] Parameters: username
  - [ ] Returns: BidderRecord | null

### DOC-028: registerBidder
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-033
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function registerBidder(username): BidderRecord
  ```
- **Documentation Plan:**
  - [ ] Description: Registers a new bidder (idempotent — returns existing if present)
  - [ ] Parameters: username
  - [ ] Returns: BidderRecord
  - [ ] Side effects: Creates cache if not loaded

### DOC-029: markPaymentLinked
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-034
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function markPaymentLinked(username, provider): void
  ```
- **Documentation Plan:**
  - [ ] Description: Marks a bidder's payment as linked, auto-registers if needed
  - [ ] Parameters: username, provider
  - [ ] Side effects: Mutates cache in-place

### DOC-030: isPaymentLinked
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-035
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function isPaymentLinked(username): boolean
  ```
- **Documentation Plan:**
  - [ ] Description: Checks if a bidder has linked payment
  - [ ] Parameters: username
  - [ ] Returns: boolean

### DOC-031: getGraceDeadline
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-036
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function getGraceDeadline(username, graceHours): Date | null
  ```
- **Documentation Plan:**
  - [ ] Description: Calculates grace period deadline from warned_at + graceHours
  - [ ] Parameters: username, graceHours
  - [ ] Returns: Date | null (null if no warned_at)

### DOC-032: setWarnedAt
- **Status:** `PENDING`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-037
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  function setWarnedAt(username, timestamp?): void
  ```
- **Documentation Plan:**
  - [ ] Description: Sets the warned_at timestamp for a bidder
  - [ ] Parameters: username, timestamp (optional, defaults to now)

### DOC-033: GitHubErrorResponse
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-039
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface GitHubErrorResponse { message; status; documentation_url? }
  ```
- **Documentation Plan:**
  - [ ] Description: Structure for GitHub API error responses
  - [ ] Properties: message, status, documentation_url

### DOC-034: GitHubAPIError
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-040
- **Type:** Class
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  class GitHubAPIError extends Error { status; documentation_url? }
  ```
- **Documentation Plan:**
  - [ ] Description: Error thrown by GitHubAPI methods
  - [ ] Properties: status, documentation_url
  - [ ] Constructor parameters

### DOC-035: GitHubAPI
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-041
- **Type:** Class
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  class GitHubAPI { constructor(owner, repo, token?) }
  ```
- **Documentation Plan:**
  - [ ] Description: Primary GitHub integration — REST + GraphQL, 15 public methods
  - [ ] Constructor parameters: owner, repo, token
  - [ ] All public method docs (15 methods)
  - [ ] Error handling: All methods throw GitHubAPIError
  - [ ] Examples: Yes

### DOC-036: GitHubAPI.createIssue
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-042
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async createIssue(title, body, labels?): Promise<IssueData>
  ```
- **Documentation Plan:**
  - [ ] Description: Creates a GitHub issue
  - [ ] Parameters: title, body, labels
  - [ ] Returns: IssueData
  - [ ] Error handling: GitHubAPIError

### DOC-037: GitHubAPI.getIssue
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-043
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getIssue(issueNumber): Promise<IssueData>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches a GitHub issue by number
  - [ ] Parameters: issueNumber
  - [ ] Returns: IssueData

### DOC-038: GitHubAPI.updateIssueBody
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-044
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async updateIssueBody(issueNumber, body): Promise<IssueData>
  ```
- **Documentation Plan:**
  - [ ] Description: Updates an issue's body content
  - [ ] Parameters: issueNumber, body
  - [ ] Returns: IssueData

### DOC-039: GitHubAPI.closeIssue
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-045
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async closeIssue(issueNumber): Promise<IssueData>
  ```
- **Documentation Plan:**
  - [ ] Description: Closes a GitHub issue
  - [ ] Parameters: issueNumber
  - [ ] Returns: IssueData

### DOC-040: GitHubAPI.pinIssue
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-046
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async pinIssue(issueNodeId): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Pins issue via GraphQL mutation (not REST)
  - [ ] Parameters: issueNodeId (GraphQL node ID, not issue number)

### DOC-041: GitHubAPI.unpinIssue
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-047
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async unpinIssue(issueNodeId): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Unpins issue via GraphQL mutation
  - [ ] Parameters: issueNodeId

### DOC-042: GitHubAPI.addComment
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-048
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async addComment(issueNumber, body): Promise<CommentData>
  ```
- **Documentation Plan:**
  - [ ] Description: Adds a comment to a GitHub issue
  - [ ] Parameters: issueNumber, body
  - [ ] Returns: CommentData

### DOC-043: GitHubAPI.getComment
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-049
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getComment(commentId): Promise<CommentData>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches a specific comment by ID
  - [ ] Parameters: commentId
  - [ ] Returns: CommentData

### DOC-044: GitHubAPI.updateComment
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-050
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async updateComment(commentId, body): Promise<CommentData>
  ```
- **Documentation Plan:**
  - [ ] Description: Updates a comment's body content
  - [ ] Parameters: commentId, body
  - [ ] Returns: CommentData

### DOC-045: GitHubAPI.getComments
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-051
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getComments(issueNumber): Promise<CommentData[]>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches all comments on an issue
  - [ ] Parameters: issueNumber
  - [ ] Returns: CommentData[]

### DOC-046: GitHubAPI.getReactions
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-052
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getReactions(commentId): Promise<ReactionData[]>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches reactions on a comment
  - [ ] Parameters: commentId
  - [ ] Returns: ReactionData[]

### DOC-047: GitHubAPI.getTrafficViews
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-053
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getTrafficViews(): Promise<{ count; uniques; views[] }>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches repo traffic view data (requires push access)
  - [ ] Returns: Traffic views with daily breakdown

### DOC-048: GitHubAPI.getTrafficClones
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-054
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getTrafficClones(): Promise<{ count; uniques; clones[] }>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches repo clone traffic data
  - [ ] Returns: Clone traffic with daily breakdown

### DOC-049: GitHubAPI.getPopularReferrers
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-055
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async getPopularReferrers(): Promise<{ referrer; count; uniques }[]>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches popular referrer sources
  - [ ] Returns: Referrer list with counts

### DOC-050: GitHubAPI.dispatchEvent
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-056
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async dispatchEvent(eventType, clientPayload): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Triggers repository_dispatch event for workflow automation
  - [ ] Parameters: eventType, clientPayload

### DOC-051: GitHubAPI.createPR
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-057
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async createPR(title, body, head, base): Promise<PR>
  ```
- **Documentation Plan:**
  - [ ] Description: Creates a pull request
  - [ ] Parameters: title, body, head, base
  - [ ] Returns: PR data with number and URL

### DOC-052: GitHubAPI.updatePRBody
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-058
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async updatePRBody(prNumber, body): Promise<PR>
  ```
- **Documentation Plan:**
  - [ ] Description: Updates a PR's body content
  - [ ] Parameters: prNumber, body
  - [ ] Returns: PR data

### DOC-053: GitHubAPI.updateReadme
- **Status:** `PENDING`
- **File:** `src/lib/github-api.ts`
- **Gap ID:** GAP-059
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async updateReadme(content, message): Promise<CommitResponse>
  ```
- **Documentation Plan:**
  - [ ] Description: Fetches existing README SHA, updates via base64 encoding, creates commit
  - [ ] Parameters: content, message
  - [ ] Returns: CommitResponse
  - [ ] Error handling: GitHubAPIError

### DOC-054: PaymentMode
- **Status:** `PENDING`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-060
- **Type:** Type
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  type PaymentMode = "polar-own" | "bidme-managed"
  ```
- **Documentation Plan:**
  - [ ] Description: Payment integration mode selection
  - [ ] Member descriptions: polar-own vs bidme-managed

### DOC-055: PaymentLinkConfig
- **Status:** `PENDING`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-062
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  interface PaymentLinkConfig { mode; bidme_fee_percent; payment_link }
  ```
- **Documentation Plan:**
  - [ ] Description: Configuration for payment link generation
  - [ ] Properties: mode, bidme_fee_percent, payment_link

### DOC-056: PolarAPI
- **Status:** `PENDING`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-067
- **Type:** Class
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  class PolarAPI { constructor(accessToken?, mode?) }
  ```
- **Documentation Plan:**
  - [ ] Description: Payment integration — two modes, graceful degradation
  - [ ] Constructor parameters: accessToken, mode
  - [ ] All public method docs (4 methods)
  - [ ] Error handling: PolarAPIError
  - [ ] Examples: Yes

### DOC-057: PolarAPI.createPaymentLink
- **Status:** `PENDING`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-071
- **Type:** Method
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async createPaymentLink(bid, config): Promise<string>
  ```
- **Documentation Plan:**
  - [ ] Description: Creates payment link, falls back to config link if Polar not configured
  - [ ] Parameters: bid, config
  - [ ] Returns: Payment URL string

### DOC-058: BidMeConfig
- **Status:** `PENDING`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-072
- **Type:** Interface
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  interface BidMeConfig { bidding; banner; approval; payment; enforcement; tracking; content_guidelines }
  ```
- **Documentation Plan:**
  - [ ] Description: Central configuration interface used by every module
  - [ ] All properties and sub-properties
  - [ ] Valid values and constraints
  - [ ] Examples: Yes

### DOC-059: DEFAULT_CONFIG
- **Status:** `PENDING`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-073
- **Type:** Const
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  const DEFAULT_CONFIG: BidMeConfig
  ```
- **Documentation Plan:**
  - [ ] Description: Default configuration with sensible values
  - [ ] Rationale for default values

### DOC-060: validateConfig
- **Status:** `PENDING`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-075
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  function validateConfig(config: unknown): BidMeConfig
  ```
- **Documentation Plan:**
  - [ ] Description: Deep merges with defaults, validates all config sections
  - [ ] Parameters: config (unknown — raw input)
  - [ ] Returns: Validated BidMeConfig
  - [ ] Error handling: Throws ConfigValidationError

### DOC-061: loadConfig
- **Status:** `PENDING`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-076
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function loadConfig(targetDir?): Promise<BidMeConfig>
  ```
- **Documentation Plan:**
  - [ ] Description: Reads TOML config from .bidme/ directory, returns defaults if missing
  - [ ] Parameters: targetDir
  - [ ] Returns: Promise<BidMeConfig>
  - [ ] Error handling: Returns defaults on file not found

### DOC-062: saveConfig
- **Status:** `PENDING`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-077
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** HIGH
- **Signature:**
  ```
  async function saveConfig(config, targetDir?): Promise<void>
  ```
- **Documentation Plan:**
  - [ ] Description: Persists config as TOML to .bidme/ directory
  - [ ] Parameters: config, targetDir

### DOC-063: generateBidIssueBody
- **Status:** `PENDING`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-084
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  function generateBidIssueBody(config, periodData, previousStats?): string
  ```
- **Documentation Plan:**
  - [ ] Description: Generates full GitHub issue body with countdown and bid sections
  - [ ] Parameters: config, periodData, previousStats
  - [ ] Returns: Markdown string

### DOC-064: updateBidIssueBody
- **Status:** `PENDING`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-087
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  function updateBidIssueBody(existingBody, bids, previousStats?): string
  ```
- **Documentation Plan:**
  - [ ] Description: Uses regex to update specific sections in existing issue body
  - [ ] Parameters: existingBody, bids, previousStats
  - [ ] Returns: Updated markdown string

### DOC-065: enforceContent
- **Status:** `PENDING`
- **File:** `src/lib/content-enforcer.ts`
- **Gap ID:** GAP-092
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function enforceContent(bid, config): Promise<{ passed; errors }>
  ```
- **Documentation Plan:**
  - [ ] Description: Orchestrates banner image validation + prohibited content check
  - [ ] Parameters: bid, config
  - [ ] Returns: { passed, errors }

### DOC-066: scaffold
- **Status:** `PENDING`
- **File:** `src/lib/scaffold.ts`
- **Gap ID:** GAP-094
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function scaffold(target, config): Promise<ScaffoldResult>
  ```
- **Documentation Plan:**
  - [ ] Description: Creates entire .bidme/ directory structure, copies workflows, updates README
  - [ ] Parameters: target, config
  - [ ] Returns: ScaffoldResult
  - [ ] Side effects: Filesystem changes

### DOC-067: runProcessBid
- **Status:** `PENDING`
- **File:** `src/commands/process-bid.ts`
- **Gap ID:** GAP-107
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function runProcessBid(issueNumber, commentId, options?): Promise<{ success; message }>
  ```
- **Documentation Plan:**
  - [ ] Description: Full bid processing pipeline — fetch, parse, validate, enforce, record
  - [ ] Parameters: issueNumber, commentId, options
  - [ ] Returns: { success, message }
  - [ ] Side effects: Posts GitHub comments

### DOC-068: runCloseBidding
- **Status:** `PENDING`
- **File:** `src/commands/close-bidding.ts`
- **Gap ID:** GAP-112
- **Type:** Function
- **Visibility:** PUBLIC
- **Importance:** CRITICAL
- **Signature:**
  ```
  async function runCloseBidding(options?): Promise<{ success; message }>
  ```
- **Documentation Plan:**
  - [ ] Description: Selects winner, processes payment, updates README, archives period
  - [ ] Parameters: options
  - [ ] Returns: { success, message }
  - [ ] Side effects: GitHub API + Polar API calls

---

## WON'T DO

### DOC-W01: formatNumber
- **Status:** `WON'T DO`
- **File:** `src/lib/badge-generator.ts`
- **Gap ID:** GAP-006
- **Reason:** UTILITY + SIMPLE — self-explanatory number formatter (k/M suffixes)

### DOC-W02: generateViewsBadge
- **Status:** `WON'T DO`
- **File:** `src/lib/badge-generator.ts`
- **Gap ID:** GAP-007
- **Reason:** INTERNAL + SIMPLE — trivial shields.io badge generator

### DOC-W03: generateCountriesBadge
- **Status:** `WON'T DO`
- **File:** `src/lib/badge-generator.ts`
- **Gap ID:** GAP-008
- **Reason:** INTERNAL + SIMPLE — trivial shields.io badge generator

### DOC-W04: generateCTRBadge
- **Status:** `WON'T DO`
- **File:** `src/lib/badge-generator.ts`
- **Gap ID:** GAP-009
- **Reason:** INTERNAL + SIMPLE — trivial shields.io badge generator

### DOC-W05: getClickThroughRate
- **Status:** `WON'T DO`
- **File:** `src/lib/analytics-store.ts`
- **Gap ID:** GAP-024
- **Reason:** UTILITY + SIMPLE — trivial calculation (clicks/views)

### DOC-W06: resetRegistryCache
- **Status:** `WON'T DO`
- **File:** `src/lib/bidder-registry.ts`
- **Gap ID:** GAP-038
- **Reason:** INTERNAL + SIMPLE — testing utility, clears module-level cache

### DOC-W07: PolarConfig
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-061
- **Reason:** INTERNAL + SIMPLE — 2-field config interface (accessToken, baseUrl)

### DOC-W08: PolarProduct
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-063
- **Reason:** PUBLIC + SIMPLE — data transfer type with self-explanatory fields

### DOC-W09: PolarCheckoutSession
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-064
- **Reason:** PUBLIC + SIMPLE — data transfer type, status values are standard

### DOC-W10: PolarErrorResponse
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-065
- **Reason:** PUBLIC + SIMPLE — 2-field error response type

### DOC-W11: PolarAPIError
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-066
- **Reason:** PUBLIC + SIMPLE — standard error class, trivial constructor

### DOC-W12: PolarAPI.createProduct
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-068
- **Reason:** PUBLIC + MODERATE — method name is self-documenting, part of PolarAPI class doc

### DOC-W13: PolarAPI.createCheckoutSession
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-069
- **Reason:** PUBLIC + MODERATE — method name is self-documenting, part of PolarAPI class doc

### DOC-W14: PolarAPI.getPaymentStatus
- **Status:** `WON'T DO`
- **File:** `src/lib/polar-integration.ts`
- **Gap ID:** GAP-070
- **Reason:** PUBLIC + SIMPLE — trivial getter with self-explanatory return type

### DOC-W15: ConfigValidationError
- **Status:** `WON'T DO`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-074
- **Reason:** PUBLIC + SIMPLE — standard error subclass with no added behavior

### DOC-W16: generateToml
- **Status:** `WON'T DO`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-078
- **Reason:** PUBLIC + MODERATE — internal serialization helper, name is self-documenting

### DOC-W17: parseToml
- **Status:** `WON'T DO`
- **File:** `src/lib/config.ts`
- **Gap ID:** GAP-079
- **Reason:** PUBLIC + SIMPLE — inverse of generateToml, self-explanatory

### DOC-W18: generateBidTable
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-080
- **Reason:** PUBLIC + MODERATE — generates markdown table, name is self-documenting

### DOC-W19: generateCurrentTopBid
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-081
- **Reason:** INTERNAL + SIMPLE — trivial template helper

### DOC-W20: generateStatsSection
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-082
- **Reason:** INTERNAL + SIMPLE — trivial template helper

### DOC-W21: generatePreviousStatsSection
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-083
- **Reason:** INTERNAL + SIMPLE — trivial template helper

### DOC-W22: generateBiddingIssueBody
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-085
- **Reason:** PUBLIC + MODERATE — similar to generateBidIssueBody, documented via DOC-063

### DOC-W23: generateWinnerAnnouncement
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-086
- **Reason:** PUBLIC + MODERATE — template generator, name is self-documenting

### DOC-W24: generateNoBidsMessage
- **Status:** `WON'T DO`
- **File:** `src/lib/issue-template.ts`
- **Gap ID:** GAP-088
- **Reason:** PUBLIC + SIMPLE — trivial message generator

### DOC-W25: validateBannerImage
- **Status:** `WON'T DO`
- **File:** `src/lib/content-enforcer.ts`
- **Gap ID:** GAP-089
- **Reason:** PUBLIC + COMPLEX — but called only via enforceContent (DOC-065), which is the orchestrator entry point

### DOC-W26: validateCommentFormat
- **Status:** `WON'T DO`
- **File:** `src/lib/content-enforcer.ts`
- **Gap ID:** GAP-090
- **Reason:** PUBLIC + MODERATE — called only via enforceContent, name is self-documenting

### DOC-W27: checkProhibitedContent
- **Status:** `WON'T DO`
- **File:** `src/lib/content-enforcer.ts`
- **Gap ID:** GAP-091
- **Reason:** PUBLIC + MODERATE — called only via enforceContent, name is self-documenting

### DOC-W28: ScaffoldResult
- **Status:** `WON'T DO`
- **File:** `src/lib/scaffold.ts`
- **Gap ID:** GAP-093
- **Reason:** PUBLIC + MODERATE — return type for scaffold(), documented via DOC-066

### DOC-W29: Migration
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/index.ts`
- **Gap ID:** GAP-095
- **Reason:** PUBLIC + SIMPLE — 3-field interface, self-explanatory

### DOC-W30: migrations
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/index.ts`
- **Gap ID:** GAP-096
- **Reason:** INTERNAL + SIMPLE — registry array

### DOC-W31: getMigrationsAfter
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/index.ts`
- **Gap ID:** GAP-097
- **Reason:** PUBLIC + SIMPLE — name is self-documenting

### DOC-W32: migrateConfig
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-098
- **Reason:** INTERNAL + COMPLEX — migration-specific code, rarely read directly

### DOC-W33: migrateData
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-099
- **Reason:** INTERNAL + COMPLEX — migration-specific code, rarely read directly

### DOC-W34: migrateWorkflows
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-100
- **Reason:** INTERNAL + MODERATE — migration-specific code

### DOC-W35: migrateReadme
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-101
- **Reason:** INTERNAL + MODERATE — migration-specific code

### DOC-W36: cleanupOldFiles
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-102
- **Reason:** INTERNAL + MODERATE — migration-specific code

### DOC-W37: v020Migration
- **Status:** `WON'T DO`
- **File:** `src/lib/migrations/v0.2.0.ts`
- **Gap ID:** GAP-103
- **Reason:** INTERNAL + MODERATE — migration constant

### DOC-W38: OpenBiddingOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/open-bidding.ts`
- **Gap ID:** GAP-104
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W39: runOpenBidding
- **Status:** `WON'T DO`
- **File:** `src/commands/open-bidding.ts`
- **Gap ID:** GAP-105
- **Reason:** PUBLIC + COMPLEX — CLI command, but behavior covered by CLI help text and README

### DOC-W40: ProcessBidOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/process-bid.ts`
- **Gap ID:** GAP-106
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W41: ProcessApprovalOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/process-approval.ts`
- **Gap ID:** GAP-108
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W42: runProcessApproval
- **Status:** `WON'T DO`
- **File:** `src/commands/process-approval.ts`
- **Gap ID:** GAP-109
- **Reason:** PUBLIC + COMPLEX — CLI command, behavior covered by CLI help text

### DOC-W43: CloseBiddingOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/close-bidding.ts`
- **Gap ID:** GAP-110
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W44: appendTrackingParams
- **Status:** `WON'T DO`
- **File:** `src/commands/close-bidding.ts`
- **Gap ID:** GAP-111
- **Reason:** PUBLIC + SIMPLE — name is self-documenting, trivial URL builder

### DOC-W45: CheckGraceOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/check-grace.ts`
- **Gap ID:** GAP-113
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W46: runCheckGrace
- **Status:** `WON'T DO`
- **File:** `src/commands/check-grace.ts`
- **Gap ID:** GAP-114
- **Reason:** PUBLIC + COMPLEX — CLI command, behavior covered by CLI help text

### DOC-W47: UpdateAnalyticsOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-115
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W48: PreviousWeekStats
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-116
- **Reason:** INTERNAL + SIMPLE — 3-field stats interface

### DOC-W49: runUpdateAnalytics
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-117
- **Reason:** PUBLIC + COMPLEX — CLI command, behavior covered by CLI help text

### DOC-W50: mergeDailyViews
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-118
- **Reason:** UTILITY + MODERATE — internal merge helper

### DOC-W51: computePreviousWeekStats
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-119
- **Reason:** UTILITY + MODERATE — internal computation helper

### DOC-W52: computePeriodAggregates
- **Status:** `WON'T DO`
- **File:** `src/commands/update-analytics.ts`
- **Gap ID:** GAP-120
- **Reason:** UTILITY + MODERATE — internal computation helper

### DOC-W53: DailyRecapOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/daily-recap.ts`
- **Gap ID:** GAP-121
- **Reason:** INTERNAL + SIMPLE — single optional field { target? }

### DOC-W54: runDailyRecap
- **Status:** `WON'T DO`
- **File:** `src/commands/daily-recap.ts`
- **Gap ID:** GAP-122
- **Reason:** PUBLIC + MODERATE — CLI command, behavior covered by CLI help text

### DOC-W55: getTodayViews
- **Status:** `WON'T DO`
- **File:** `src/commands/daily-recap.ts`
- **Gap ID:** GAP-123
- **Reason:** UTILITY + SIMPLE — trivial date filter

### DOC-W56: getTodayClicks
- **Status:** `WON'T DO`
- **File:** `src/commands/daily-recap.ts`
- **Gap ID:** GAP-124
- **Reason:** UTILITY + SIMPLE — trivial date filter

### DOC-W57: formatRecap
- **Status:** `WON'T DO`
- **File:** `src/commands/daily-recap.ts`
- **Gap ID:** GAP-125
- **Reason:** UTILITY + MODERATE — internal formatting helper

### DOC-W58: VersionInfo
- **Status:** `WON'T DO`
- **File:** `src/commands/update.ts`
- **Gap ID:** GAP-126
- **Reason:** INTERNAL + SIMPLE — 3-field version tracking interface

### DOC-W59: UpdateResult
- **Status:** `WON'T DO`
- **File:** `src/commands/update.ts`
- **Gap ID:** GAP-127
- **Reason:** PUBLIC + SIMPLE — result type with self-explanatory fields

### DOC-W60: runUpdate
- **Status:** `WON'T DO`
- **File:** `src/commands/update.ts`
- **Gap ID:** GAP-128
- **Reason:** PUBLIC + COMPLEX — CLI command, behavior covered by CLI help text

### DOC-W61: InitOptions
- **Status:** `WON'T DO`
- **File:** `src/commands/init.ts`
- **Gap ID:** GAP-129
- **Reason:** INTERNAL + SIMPLE — 2-field options interface

### DOC-W62: WizardConfig
- **Status:** `WON'T DO`
- **File:** `src/commands/init.ts`
- **Gap ID:** GAP-130
- **Reason:** INTERNAL + SIMPLE — type alias for BidMeConfig

### DOC-W63: DEFAULT_WIZARD_CONFIG
- **Status:** `WON'T DO`
- **File:** `src/commands/init.ts`
- **Gap ID:** GAP-131
- **Reason:** INTERNAL + SIMPLE — constant, same as DEFAULT_CONFIG

### DOC-W64: collectConfig
- **Status:** `WON'T DO`
- **File:** `src/commands/init.ts`
- **Gap ID:** GAP-132
- **Reason:** PUBLIC + COMPLEX — interactive wizard, but only used by runInit

### DOC-W65: runInit
- **Status:** `WON'T DO`
- **File:** `src/commands/init.ts`
- **Gap ID:** GAP-133
- **Reason:** PUBLIC + COMPLEX — CLI command, behavior covered by CLI help text

### DOC-W66: getVersion
- **Status:** `WON'T DO`
- **File:** `src/cli.ts`
- **Gap ID:** GAP-134
- **Reason:** UTILITY + SIMPLE — trivial version reader

---

## Documentation Order

Recommended sequence based on visibility, dependencies, and groups:

1. **DOC-021** - BidRecord (PUBLIC, CRITICAL — core domain type used everywhere)
2. **DOC-022** - PeriodData (PUBLIC, CRITICAL — core domain type used everywhere)
3. **DOC-007** - ParsedBid (PUBLIC, CRITICAL — core validation type)
4. **DOC-008** - ValidationError (PUBLIC, HIGH — used by validation pipeline)
5. **DOC-009** - ValidationResult (PUBLIC, HIGH — used by validation pipeline)
6. **DOC-058** - BidMeConfig (PUBLIC, CRITICAL — central config, used by all modules)
7. **DOC-059** - DEFAULT_CONFIG (PUBLIC, HIGH — default values reference)
8. **DOC-060** - validateConfig (PUBLIC, CRITICAL — config validation)
9. **DOC-061** - loadConfig (PUBLIC, HIGH — config loading)
10. **DOC-062** - saveConfig (PUBLIC, HIGH — config persistence)
11. **DOC-001** - BidMeErrorCode (PUBLIC, HIGH — error codes)
12. **DOC-002** - BidMeError (PUBLIC, CRITICAL — central error type)
13. **DOC-003** - logError (PUBLIC, HIGH — error logging)
14. **DOC-004** - withRetry (PUBLIC, CRITICAL — retry utility)
15. **DOC-005** - isRateLimited (PUBLIC, HIGH — rate limit detection)
16. **DOC-010** - parseBidComment (PUBLIC, CRITICAL — bid parsing entry point)
17. **DOC-011** - validateBid (PUBLIC, CRITICAL — bid validation)
18. **DOC-012** - validateBannerUrl (PUBLIC, CRITICAL — URL validation)
19. **DOC-065** - enforceContent (PUBLIC, CRITICAL — content enforcement orchestrator)
20. **DOC-035** - GitHubAPI (PUBLIC, CRITICAL — GitHub integration class)
21. **DOC-036** through **DOC-053** - GitHubAPI methods (PUBLIC, HIGH — API methods)
22. **DOC-033** - GitHubErrorResponse (PUBLIC, HIGH — error type)
23. **DOC-034** - GitHubAPIError (PUBLIC, HIGH — error class)
24. **DOC-056** - PolarAPI (PUBLIC, CRITICAL — payment integration)
25. **DOC-054** - PaymentMode (PUBLIC, HIGH — payment mode type)
26. **DOC-055** - PaymentLinkConfig (PUBLIC, HIGH — payment config)
27. **DOC-057** - PolarAPI.createPaymentLink (PUBLIC, CRITICAL — payment link generation)
28. **DOC-023** through **DOC-032** - Bidder registry functions (PUBLIC, HIGH)
29. **DOC-013** through **DOC-020** - Analytics store types and functions (PUBLIC, HIGH)
30. **DOC-006** - generateBannerSection (PUBLIC, HIGH — badge generator)
31. **DOC-063** - generateBidIssueBody (PUBLIC, CRITICAL — issue template)
32. **DOC-064** - updateBidIssueBody (PUBLIC, CRITICAL — issue template update)
33. **DOC-066** - scaffold (PUBLIC, CRITICAL — project scaffolding)
34. **DOC-067** - runProcessBid (PUBLIC, CRITICAL — bid processing pipeline)
35. **DOC-068** - runCloseBidding (PUBLIC, CRITICAL — close bidding pipeline)

## Related Documentation

Exports that should be documented together for consistency:

- **Group A:** DOC-058, DOC-059, DOC-060, DOC-061, DOC-062 — Configuration lifecycle
- **Group B:** DOC-021, DOC-022 — Core domain types used everywhere
- **Group C:** DOC-007, DOC-008, DOC-009, DOC-010, DOC-011, DOC-012 — Bid validation pipeline
- **Group D:** DOC-035 through DOC-053, DOC-033, DOC-034 — GitHub integration
- **Group E:** DOC-056, DOC-054, DOC-055, DOC-057 — Payment integration
- **Group F:** DOC-023 through DOC-032 — Bidder registry lifecycle
- **Group G:** DOC-013 through DOC-020 — Analytics store
- **Group H:** DOC-065 — Content enforcement pipeline
- **Group I:** DOC-063, DOC-064 — Issue template generation
- **Group J:** DOC-067, DOC-068 — CLI command entry points (critical path only)

---
---

# README Accuracy Fix Plan - Loop 00001

## Summary
- **Total Gaps:** 12
- **Auto-Fix (PENDING):** 10
- **Needs Review:** 0
- **Won't Do:** 2

## Current README Accuracy: 60%
## Target README Accuracy: 95%

---

## PENDING - Ready for Auto-Fix

### README-001: Bid `url` vs `destination_url` field name
- **Status:** `IMPLEMENTED`
- **Implemented In:** Loop 00001
- **Gap ID:** GAP-010
- **Type:** INACCURATE
- **User Importance:** CRITICAL
- **Fix Effort:** EASY
- **README Section:** For Advertisers (lines 84, 94)
- **Fix Description:**
  Change `url` to `destination_url` in both the YAML example and the fields table. Bids following the current README will silently fail validation.
- **Changes Made:**
  - [x] Changed `url` to `destination_url` in YAML bid example
  - [x] Changed `url` to `destination_url` in fields table

### README-002: Remove stale `alt_text` field
- **Status:** `PENDING`
- **Gap ID:** GAP-009
- **Type:** STALE
- **User Importance:** HIGH
- **Fix Effort:** EASY
- **README Section:** For Advertisers (lines 86, 96)
- **Fix Description:**
  Remove `alt_text` from YAML example and fields table. The code does not parse or use this field — advertisers are misled into providing it.
- **Proposed Content:**
  ```markdown
  # Remove this line from YAML example:
  #   alt_text: "YourCompany - Build faster with our tools"
  # Remove this row from table:
  #   | `alt_text` | Yes | Accessible description of your banner |
  ```

### README-003: Contact field accepts @username
- **Status:** `PENDING`
- **Gap ID:** GAP-011
- **Type:** INACCURATE
- **User Importance:** HIGH
- **Fix Effort:** EASY
- **README Section:** For Advertisers (line 97)
- **Fix Description:**
  Update contact field description to mention GitHub @username as a valid option.
- **Proposed Content:**
  ```markdown
  | `contact` | Yes | Email or GitHub @username for bid communications |
  ```

### README-004: `approval.mode = "auto"` option
- **Status:** `PENDING`
- **Gap ID:** GAP-006
- **Type:** MISSING
- **User Importance:** HIGH
- **Fix Effort:** EASY
- **README Section:** Configuration — [approval] section (line 42)
- **Fix Description:**
  Update the approval mode comment to mention `"auto"` as an alternative to `"emoji"`.
- **Proposed Content:**
  ```markdown
  [approval]
  mode = "emoji"             # "emoji" (approve via reaction) or "auto" (auto-accept all valid bids)
  allowed_reactions = ["👍"]
  ```

### README-005: `[enforcement]` config section
- **Status:** `PENDING`
- **Gap ID:** GAP-004
- **Type:** MISSING
- **User Importance:** HIGH
- **Fix Effort:** MEDIUM
- **README Section:** Configuration — after [content_guidelines] section
- **Fix Description:**
  Add the `[enforcement]` config section documenting payment enforcement controls.
- **Proposed Content:**
  ```markdown
  [enforcement]
  require_payment_before_bid = true    # Require linked payment to bid
  strikethrough_unlinked = true        # Strike through bids from unlinked bidders
  ```

### README-006: Additional `[payment]` config options
- **Status:** `PENDING`
- **Gap ID:** GAP-007
- **Type:** MISSING
- **User Importance:** HIGH
- **Fix Effort:** MEDIUM
- **README Section:** Configuration — [payment] section (lines 46-47)
- **Fix Description:**
  Add `allow_unlinked_bids`, `unlinked_grace_hours`, and `payment_link` to the payment config section.
- **Proposed Content:**
  ```markdown
  [payment]
  provider = "polar-own"
  bidme_fee_percent = 10               # Fee percentage (0-100)
  allow_unlinked_bids = false          # Allow bids from users without linked payment
  unlinked_grace_hours = 24            # Grace period to link payment after bidding
  payment_link = "https://bidme.dev/link-payment"
  ```

### README-007: `[tracking]` config section
- **Status:** `PENDING`
- **Gap ID:** GAP-005
- **Type:** MISSING
- **User Importance:** MEDIUM
- **Fix Effort:** MEDIUM
- **README Section:** Configuration — after [enforcement] section
- **Fix Description:**
  Add the `[tracking]` config section so users know UTM tracking is on by default and can customize/disable it.
- **Proposed Content:**
  ```markdown
  [tracking]
  append_utm = true                    # Append UTM parameters to bid destination URLs
  utm_params = "source=bidme&repo={owner}/{repo}"
  ```

### README-008: `--defaults` flag on `bidme init`
- **Status:** `PENDING`
- **Gap ID:** GAP-001
- **Type:** MISSING
- **User Importance:** MEDIUM
- **Fix Effort:** EASY
- **README Section:** Commands table — init row (line 58)
- **Fix Description:**
  Mention the `--defaults` flag for non-interactive init in the commands table.
- **Proposed Content:**
  ```markdown
  | `bidme init` | Interactive setup wizard — scaffolds config, workflows, and README banner. Use `--defaults` to skip prompts. |
  ```

### README-009: `bidme_fee_percent` range
- **Status:** `PENDING`
- **Gap ID:** GAP-012
- **Type:** INCOMPLETE
- **User Importance:** MEDIUM
- **Fix Effort:** EASY
- **README Section:** Configuration — [payment] section (line 47)
- **Fix Description:**
  Add inline comment noting valid range. (Subsumed by README-006 which includes the range in the proposed content.)
- **Note:** This fix is covered by README-006's proposed content.

### README-010: `--target <path>` global flag
- **Status:** `PENDING`
- **Gap ID:** GAP-002
- **Type:** MISSING
- **User Importance:** LOW
- **Fix Effort:** EASY
- **README Section:** Commands section — add note after table
- **Fix Description:**
  Add a brief note that all commands accept `--target <path>` for monorepo/CI use.
- **Proposed Content:**
  ```markdown
  All commands accept `--target <path>` to operate on a different project directory.
  ```

---

## WON'T DO

### README-W01: `--version` / `-v` flag
- **Status:** `WON'T DO`
- **Gap ID:** GAP-003
- **Reason:** LOW impact — standard CLI convention, trivially discoverable by running `bidme --version`. Adding to commands table would add clutter for negligible user benefit.

### README-W02: Click tracking via `redirect.html`
- **Status:** `WON'T DO`
- **Gap ID:** GAP-008
- **Reason:** LOW importance + HARD effort — advanced analytics feature that requires comprehensive setup docs. Few users would enable this. Better suited for a dedicated "Advanced Features" page in future.

---

## Fix Order

Recommended sequence based on importance and dependencies:

1. **README-001** — Bid `url` → `destination_url` (CRITICAL — bids actively fail)
2. **README-002** — Remove stale `alt_text` (HIGH — misleading advertiser docs)
3. **README-003** — Contact accepts @username (HIGH — quick accuracy fix)
4. **README-004** — Add `approval.mode = "auto"` (HIGH — easy one-liner)
5. **README-005** — Add `[enforcement]` config section (HIGH — payment enforcement controls)
6. **README-006** — Expand `[payment]` config options (HIGH — includes fee range fix from README-009)
7. **README-007** — Add `[tracking]` config section (MEDIUM — users should know UTM is on)
8. **README-008** — `--defaults` flag on init (MEDIUM — CI/automation use case)
9. **README-010** — `--target <path>` global flag (LOW — monorepo/CI niche)

*Note: README-009 is subsumed by README-006.*

## README Section Updates Needed

| Section | Gaps to Fix | Action Needed |
|---------|-------------|---------------|
| For Advertisers — YAML example | README-001, README-002 | Fix `url` → `destination_url`, remove `alt_text` |
| For Advertisers — Fields table | README-001, README-002, README-003 | Fix field name, remove row, update contact description |
| Configuration — [approval] | README-004 | Update comment to mention "auto" mode |
| Configuration — [payment] | README-006 (includes README-009) | Add 3 missing options with range comment |
| Configuration — new sections | README-005, README-007 | Add [enforcement] and [tracking] sections |
| Commands — init row | README-008 | Add `--defaults` mention |
| Commands — after table | README-010 | Add `--target` note |
