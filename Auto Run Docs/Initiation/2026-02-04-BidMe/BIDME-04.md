# Phase 04: Analytics System & GitHub Pages Dashboard

This phase builds the analytics pipeline and user-facing dashboard. It implements the GitHub Traffic API integration, redirect click tracking with data persistence, shields.io badge generation from real data, and a GitHub Pages dashboard where repo owners can see bidding history and analytics at a glance. Advertisers also get a view of the analytics to understand the value of their banner placement.

## Tasks

- [x] Create the analytics updater script:
  - Create `scripts/analytics-updater.ts` that:
    - Fetches repository traffic data using the GitHub Traffic API (`/repos/{owner}/{repo}/traffic/views` and `/traffic/clones`)
    - Fetches referrer data from `/repos/{owner}/{repo}/traffic/popular/referrers`
    - Reads existing analytics from `data/analytics.json` (create if doesn't exist)
    - Merges new data with historical data (GitHub Traffic API only returns 14 days, so we accumulate)
    - Tracks: total views, unique visitors, country distribution (from referrers), daily view counts
    - Writes updated analytics back to `data/analytics.json`
    - Generates updated badge URLs using `badge-generator.ts` and updates the README banner section between the `<!-- BIDME:BANNER:START/END -->` markers

- [x] Create the analytics data schema and storage module:
  - Create `scripts/utils/analytics-store.ts` with:
    - `AnalyticsData` type: `{ totalViews, uniqueVisitors, dailyViews[], clicks[], countries: Record<string, number>, periods: PeriodAnalytics[] }`
    - `loadAnalytics(): AnalyticsData` — reads from `data/analytics.json` with defaults
    - `saveAnalytics(data: AnalyticsData)` — writes to `data/analytics.json`
    - `recordClick(bannerId, timestamp, referrer?)` — appends click event
    - `getClickThroughRate(views, clicks)` — calculates CTR as percentage
    - `aggregateByPeriod(data, periodId)` — filters analytics for a specific bidding period

- [x] Create the analytics GitHub Action workflow:
  - Create `.github/workflows/update-analytics.yml`:
    - Trigger: `schedule` with cron `0 */6 * * *` (every 6 hours) plus `workflow_dispatch`
    - Permissions: `contents: write`
    - Steps: checkout repo, setup Bun, install dependencies, run `bun run scripts/analytics-updater.ts`
    - Commit and push any changes to `data/analytics.json` and README badge updates
    - Pass `GITHUB_TOKEN` for Traffic API access
  - ✅ Completed: Created workflow following existing project conventions (matches close-bidding.yml pattern). Commits both `data/analytics.json` and `README.md` badge updates.

- [x] Enhance the redirect page with proper click tracking:
  - Update `pages/redirect.html` to:
    - Parse `id`, `dest`, and optional `ref` query parameters
    - Send a GitHub Actions `repository_dispatch` event via the GitHub API to log the click (event type: `bidme-click`, payload: `{ banner_id, timestamp, referrer }`)
    - If the API call fails, fall back to a tracking pixel approach using a shields.io badge hit counter
    - Append `?ref={owner}/{repo}` to the destination URL
    - Show a brief branded interstitial ("Redirecting via BidMe...") for 1-2 seconds before redirect
    - Handle edge cases: missing `dest` parameter (show error), malformed URLs (show error)
  - ✅ Completed: Updated redirect.html with full click tracking. Created `scripts/handle-click.ts` to process `bidme-click` dispatch events. Updated `update-analytics.yml` with `repository_dispatch` trigger and `track-click` job. Tests: 311 pass / 0 fail.

- [ ] Build the GitHub Pages dashboard:
  - Create `pages/dashboard.html` — a responsive single-page dashboard that:
    - Fetches `data/analytics.json` and `data/current-period.json` from the repo's raw GitHub content URL
    - Displays: current banner with click-through link, view count chart (simple bar chart using CSS, no JS charting library), country distribution list, CTR metric card, bidding period history table
    - Shows current bidding period status: open/closed, highest bid, time remaining
    - Uses the shared `style.css` with dark theme
    - Is fully static (no server needed — reads JSON files from the repo)
  - Create `pages/assets/js/dashboard.js` with:
    - `fetchRepoData(owner, repo, path)` — fetches JSON from GitHub raw content
    - `renderAnalytics(data)` — populates the dashboard DOM
    - `renderBiddingStatus(period)` — shows current period info
    - `formatNumber(n)` — human-readable numbers (1.2k, 3.4M)

- [ ] Build the admin page for repository owners:
  - Create `pages/admin.html` — an admin interface that:
    - Shows all current bids with approve/reject buttons (these generate the correct emoji reaction URL for the owner to click)
    - Displays configuration summary from `bidme-config.yml`
    - Shows payment status for completed periods (fetched from `data/archive/` files)
    - Links to the current bidding issue directly
    - Includes a "Manual Actions" section with buttons to trigger workflows via `workflow_dispatch` (links to the GitHub Actions run URL)
  - Create `pages/assets/js/admin.js` with the admin page logic

- [ ] Write tests for the analytics store module:
  - Create `scripts/__tests__/analytics-store.test.ts`:
    - Test `loadAnalytics()` with existing data and missing file
    - Test `recordClick()` appends correctly
    - Test `getClickThroughRate()` with various ratios and edge cases (0 views)
    - Test `aggregateByPeriod()` filters correctly
  - Create `scripts/__tests__/badge-generator.test.ts`:
    - Test number formatting: 0, 999, 1200→"1.2k", 1500000→"1.5M"
    - Test badge URL generation for views, countries, CTR
  - Run `bun test` and fix any failures
