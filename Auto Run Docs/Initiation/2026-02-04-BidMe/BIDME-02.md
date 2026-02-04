# Phase 02: Bidding System Core Logic

This phase builds the heart of BidMe — the TypeScript scripts that power the bidding lifecycle. It implements bid opening (creating PRs on schedule), bid processing (parsing and validating comments), bid approval (tracking emoji reactions), and bid closing (selecting winners and updating the README). Each script is designed to be called by GitHub Actions workflows, which will be wired up in Phase 03.

## Tasks

- [ ] Create the bid opener script that initiates a new bidding period:
  - Create `scripts/bid-opener.ts` that:
    - Loads config via `loadConfig()`
    - Calculates the bidding period dates (start now, end based on `duration` config)
    - Generates a PR title like "🎯 BidMe: Banner Bidding [Jan 15 - Jan 22, 2026]"
    - Generates a PR body with: bidding rules (min bid, increment, formats), current status table (no bids yet), how to bid (format template), and deadline
    - Creates a new branch `bidme/period-YYYY-MM-DD` from `main`
    - Opens a PR using `GitHubAPI.createPR()`
    - Creates a `data/current-period.json` file tracking: period ID, start/end dates, PR number, status "open", bids array
  - The script should be runnable via `bun run scripts/bid-opener.ts` (will fail without GITHUB_TOKEN but should show intent clearly via console output)

- [ ] Create the bid processor script that handles incoming bid comments:
  - Create `scripts/bid-processor.ts` that:
    - Accepts PR number and comment ID as CLI arguments (these come from the GitHub Action event payload)
    - Fetches the comment body using `GitHubAPI.getComments()`
    - Parses the comment with `parseBidComment()`
    - Validates the bid with `validateBid()` — checks minimum, increment over current highest, format rules
    - If valid: updates `data/current-period.json` adding the bid to the bids array, updates the PR body with the new highest bid table using `GitHubAPI.updatePRBody()`, replies to the comment with a confirmation message
    - If invalid: replies to the comment explaining what was wrong (e.g., "Bid of $30 is below minimum of $50")
    - Tracks bid status: "pending" (awaiting owner approval), amounts, bidder info

- [ ] Create the bid approval processor that handles owner emoji reactions:
  - Create `scripts/approval-processor.ts` that:
    - Accepts PR number and comment ID as CLI arguments
    - Fetches reactions on the comment using `GitHubAPI.getReactions()`
    - Checks if the repo owner (from `GITHUB_REPOSITORY_OWNER` env) has reacted
    - 👍 reaction → marks bid as "approved" in `data/current-period.json`
    - 👎 reaction → marks bid as "rejected" in `data/current-period.json`
    - Updates the PR body to reflect current highest *approved* bid
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
      - Adds a closing comment to the PR announcing the winner
      - Closes the PR
    - If no approved bids: closes the PR with a "no winner" comment
    - Archives the period data to `data/archive/period-YYYY-MM-DD.json`
    - Clears `data/current-period.json`

- [ ] Create the PR body template generator for consistent formatting:
  - Create `scripts/utils/pr-template.ts` with functions:
    - `generateBiddingPRBody(period, config, bids)` — returns full PR body markdown with: rules section, bid table (rank, bidder, amount, status, banner preview), how-to-bid section with format template, deadline countdown
    - `generateBidTable(bids)` — returns a markdown table of all bids sorted by amount descending, with status emoji (⏳ pending, ✅ approved, ❌ rejected)
    - `generateWinnerAnnouncement(bid, period)` — returns closing comment markdown celebrating the winner
    - `generateNoBidsMessage(period)` — returns closing comment for periods with no valid bids

- [ ] Write tests for the bid validation and parsing logic:
  - Create `scripts/__tests__/validation.test.ts` using Bun's built-in test runner:
    - Test `parseBidComment()`: valid bid, missing fields, malformed YAML, extra whitespace, bid with optional message
    - Test `validateBid()`: below minimum, valid bid, below increment, invalid URL format, valid edge cases
  - Create `scripts/__tests__/pr-template.test.ts`:
    - Test `generateBidTable()` with 0 bids, 1 bid, multiple bids sorted correctly
    - Test `generateBiddingPRBody()` produces valid markdown with all sections

- [ ] Run all tests and fix any failures:
  - Run `bun test` to execute all test files
  - Fix any failing tests or broken implementations
  - Ensure all tests pass before completing this phase
