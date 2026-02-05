# Phase 03: Core Bidding Engine Rewrite

This phase rewrites the bid processing pipeline — opener, processor, approval, and closer — under the new `src/` structure. The key behavioral changes: individual bids are now approved (not the winning bid), bid approval is configurable (auto-accept or emoji react), the bid issue body live-updates with the current top bid and link, and winning bid destination URLs automatically get `?source=bidme&repo={owner}/{repo}` tracking params appended. All data paths use `.bidme/data/`.

## Tasks

- [x] Rewrite the bid opener as a CLI-invokable command:
  - `src/commands/open-bidding.ts`:
    - Loads config from `.bidme/config.toml`
    - Creates a pinned GitHub issue with the `bidme` label
    - Issue body includes: rules (from config), bid format instructions, empty bid table, deadline, and **previous week's stats** placeholder (filled if `.bidme/data/analytics.json` has data)
    - Saves period state to `.bidme/data/current-period.json` with structure: `{ period_id, status: "open", start_date, end_date, issue_number, issue_url, bids: [], created_at }`
    - Pins the issue via GitHub GraphQL API
  - Register as CLI command: `bidme open-bidding` in `src/cli.ts`
  - Port logic from `scripts/bid-opener.ts` but adapt to new `.bidme/` paths and config format

- [x] Rewrite the bid processor with approval-per-bid logic:
  - `src/commands/process-bid.ts`:
    - Loads config, reads period data from `.bidme/data/current-period.json`
    - Fetches comment via GitHub API, parses bid using `src/lib/validation.ts`
    - Validates bid amount, format, URLs (existing logic)
    - **New**: If `config.approval.mode === "auto"`, set bid status to `"approved"` immediately
    - **New**: If `config.approval.mode === "emoji"`, set bid status to `"pending"` and post a comment telling the repo owner to react with configured emoji to approve
    - Records bid in period data, saves to `.bidme/data/current-period.json`
    - **New**: Updates issue body with live bid info:
      - Current highest approved bid amount + bidder + link to their comment
      - Full bid table (all bids with status)
      - Stats from previous completed period (views, clicks) as social proof
    - Posts confirmation or rejection comment
  - Register as CLI command: `bidme process-bid <issue> <comment>` in `src/cli.ts`

- [ ] Rewrite the approval processor for individual bid approval:
  - `src/commands/process-approval.ts`:
    - Loads config, reads period data
    - Fetches reactions on the specific bid comment (not the issue)
    - Checks if repo owner reacted with one of `config.approval.allowed_reactions`
    - Updates that specific bid's status to `"approved"` or `"rejected"`
    - **New**: After approval, re-evaluate the issue body — update "Current Top Bid" section to show the highest *approved* bid
    - Posts confirmation comment: "Bid by @user for $X has been approved/rejected"
    - Saves updated period data
  - Register as CLI command: `bidme process-approval <issue> <comment>` in `src/cli.ts`

- [ ] Rewrite the bid closer with tracking URL injection:
  - `src/commands/close-bidding.ts`:
    - Loads config, reads period data
    - Selects the highest *approved* bid as winner (not just highest bid)
    - If no approved bids, posts "No approved bids" and closes cleanly
    - **New**: Appends tracking params to winner's destination URL: `?source=bidme&repo={owner}/{repo}` (or `&source=...` if URL already has query params)
    - Updates README.md between BIDME banner markers:
      - Winner's `banner_url` as an image
      - Image wrapped in a link to the tracking-appended `destination_url`
      - Small "Sponsored via BidMe" text below
    - Creates Polar.sh checkout session for the winner (port existing logic)
    - Archives period to `.bidme/data/archive/period-{date}.json`
    - Unpins and closes the issue
    - Resets `.bidme/data/current-period.json`
  - Register as CLI command: `bidme close-bidding` in `src/cli.ts`

- [ ] Create the issue template generator with live-updating support:
  - `src/lib/issue-template.ts` — rewrite to support v2 features:
    - `generateBidIssueBody(config, periodData, previousStats?)` — generates the full issue body markdown:
      - **Header**: "🏷️ Banner Sponsorship — {schedule} Bidding Period"
      - **Current Top Bid** section: shows highest approved bid amount, bidder, and link to their comment. Shows "No bids yet" if empty.
      - **Previous Period Stats** section: "Previous BidMe sponsorship garnered X views, Y clicks" (from analytics data). Omitted if no previous data.
      - **Rules**: min bid, increment, accepted formats, max size — derived from config
      - **Bid Table**: Rank | Bidder | Amount | Status | Banner Preview — auto-generated from bids array
      - **How to Bid**: YAML format instructions
      - **Deadline**: end date with countdown
    - `updateBidIssueBody(existingBody, bids, stats?)` — surgically updates just the bid table and current top bid sections without touching other content

- [ ] Write tests for the core bidding engine:
  - `src/commands/__tests__/bidding.test.ts`:
    - Test bid parsing and validation with new config structure
    - Test auto-approve mode sets bid status to "approved" immediately
    - Test emoji mode sets bid status to "pending"
    - Test issue body generation includes previous stats when available
    - Test issue body updates correctly with new bids (current top bid section)
    - Test close-bidding selects highest *approved* bid, not just highest
    - Test tracking URL injection: appends `?source=bidme&repo=...` correctly
    - Test tracking URL injection: uses `&` when URL already has query params
    - Test archive period data structure
  - Use mocked GitHub API (no real API calls)

- [ ] Run bidding engine tests and fix any failures until all pass.
