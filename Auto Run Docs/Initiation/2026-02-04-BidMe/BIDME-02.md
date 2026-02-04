# Phase 02: Bidding System Core Logic

This phase builds the heart of BidMe — the TypeScript scripts that power the bidding lifecycle. It implements bid opening (creating pinned issues on schedule), bid processing (parsing and validating comments), bid approval (tracking emoji reactions), and bid closing (selecting winners and updating the README). Each script is designed to be called by GitHub Actions workflows, which will be wired up in Phase 03.

## Tasks

- [x] Create the bid opener script that initiates a new bidding period: *(Completed: scripts/bid-opener.ts with config loading, date calculation, issue creation, pinning, label, period data file. Tests in tests/bid-opener.test.ts — 4 tests passing.)*
  - Create `scripts/bid-opener.ts` that:
    - Loads config via `loadConfig()`
    - Calculates the bidding period dates (start now, end based on `duration` config)
    - Generates an issue title like "🎯 BidMe: Banner Bidding [Jan 15 - Jan 22, 2026]"
    - Generates an issue body with: bidding rules (min bid, increment, formats), current status table (no bids yet), how to bid (format template), and deadline
    - Creates a new issue using `GitHubAPI.createIssue()`
    - Pins the issue using `GitHubAPI.pinIssue()` so it stays visible at the top of the Issues tab
    - Adds a `bidme` label to the issue for easy filtering
    - Creates a `data/current-period.json` file tracking: period ID, start/end dates, issue number, status "open", bids array
  - The script should be runnable via `bun run scripts/bid-opener.ts` (will fail without GITHUB_TOKEN but should show intent clearly via console output)

- [x] Create the bid processor script that handles incoming bid comments: *(Completed: scripts/bid-processor.ts with comment fetching, bid parsing, validation, increment checking, period data update, issue body update with bid table, and confirmation replies. Added getComment() and getIssue() to GitHubAPI. Tests in tests/bid-processor.test.ts — 13 tests passing including generateBidTable, updateIssueBodyWithBids, processBid flow, CLI argument handling, and new API methods.)*
  - Create `scripts/bid-processor.ts` that:
    - Accepts issue number and comment ID as CLI arguments (these come from the GitHub Action event payload)
    - Fetches the comment body using `GitHubAPI.getComments()`
    - Parses the comment with `parseBidComment()`
    - Validates the bid with `validateBid()` — checks minimum, increment over current highest, format rules
    - If valid: updates `data/current-period.json` adding the bid to the bids array, updates the issue body with the new highest bid table using `GitHubAPI.updateIssueBody()`, replies to the comment with a confirmation message
    - If invalid: replies to the comment explaining what was wrong (e.g., "Bid of $30 is below minimum of $50")
    - Tracks bid status: "pending" (awaiting owner approval), amounts, bidder info

- [ ] Create the bid approval processor that handles owner emoji reactions:
  - Create `scripts/approval-processor.ts` that:
    - Accepts issue number and comment ID as CLI arguments
    - Fetches reactions on the comment using `GitHubAPI.getReactions()`
    - Checks if the repo owner (from `GITHUB_REPOSITORY_OWNER` env) has reacted
    - 👍 reaction → marks bid as "approved" in `data/current-period.json`
    - 👎 reaction → marks bid as "rejected" in `data/current-period.json`
    - Updates the issue body to reflect current highest *approved* bid
    - Replies to the comment confirming the approval/rejection status

- [ ] Create the bid closer script that finalizes a bidding period:
  - Create `scripts/bid-closer.ts` that:
    - Loads `data/current-period.json` to get all bids for the current period
    - Filters to only "approved" bids
    - Selects the highest approved bid as the winner
    - If a winner exists:
      - Reads the current README.md
      - Replaces content between `<!-- BIDME:BANNER:START -->` and `<!-- BIDME:BANNER:END -->` with the winning banner markdown (using `generateBannerSection()` from badge-generator)
      - Commits the updated README via `GitHubAPI.updateReadme()`
      - Adds a closing comment to the issue announcing the winner
      - Unpins the issue using `GitHubAPI.unpinIssue()`
      - Closes the issue using `GitHubAPI.closeIssue()`
    - If no approved bids: closes the issue with a "no winner" comment, unpins it
    - Archives the period data to `data/archive/period-YYYY-MM-DD.json`
    - Clears `data/current-period.json`

- [ ] Create the issue body template generator for consistent formatting:
  - Create `scripts/utils/issue-template.ts` with functions:
    - `generateBiddingIssueBody(period, config, bids)` — returns full issue body markdown with: rules section, bid table (rank, bidder, amount, status, banner preview), how-to-bid section with format template, deadline countdown
    - `generateBidTable(bids)` — returns a markdown table of all bids sorted by amount descending, with status emoji (⏳ pending, ✅ approved, ❌ rejected)
    - `generateWinnerAnnouncement(bid, period)` — returns closing comment markdown celebrating the winner
    - `generateNoBidsMessage(period)` — returns closing comment for periods with no valid bids

- [ ] Write tests for the bid validation and parsing logic:
  - Create `scripts/__tests__/validation.test.ts` using Bun's built-in test runner:
    - Test `parseBidComment()`: valid bid, missing fields, malformed YAML, extra whitespace, bid with optional message
    - Test `validateBid()`: below minimum, valid bid, below increment, invalid URL format, valid edge cases
  - Create `scripts/__tests__/issue-template.test.ts`:
    - Test `generateBidTable()` with 0 bids, 1 bid, multiple bids sorted correctly
    - Test `generateBiddingIssueBody()` produces valid markdown with all sections

- [ ] Run all tests and fix any failures:
  - Run `bun test` to execute all test files
  - Fix any failing tests or broken implementations
  - Ensure all tests pass before completing this phase
