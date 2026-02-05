# Phase 06: Analytics, Content Enforcement & Image Validation

This phase implements inline analytics on bid issues (social proof for advertisers), the content/image enforcement system that validates banner submissions against configurable size and format rules, and the analytics updater command. Analytics are shown directly on bid issues — no standalone dashboard. The daily recap email system is stubbed for now (marked as future enhancement) since it requires email infrastructure.

## Tasks

- [x] Build the analytics updater command:
  - `src/commands/update-analytics.ts`:
    - Fetches GitHub Traffic API data: `/repos/{owner}/{repo}/traffic/views` and `/repos/{owner}/{repo}/traffic/referrers`
    - Merges new daily view data into `.bidme/data/analytics.json` (keeps highest counts per day, same logic as old `analytics-updater.ts`)
    - Tracks click events from `repository_dispatch` payloads (stored in analytics.json clicks array)
    - Computes period-level aggregates: total views, clicks, CTR for each completed period
    - Generates a `previousWeekStats` summary: `{ views, clicks, ctr }` for the most recent full 7-day window
    - Saves updated analytics to `.bidme/data/analytics.json`
    - Commits changes back to repo (handled by the GitHub Action's auto-commit step)
  - Register as CLI command: `bidme update-analytics` in `src/cli.ts`
  - ✅ Completed: Created `src/commands/update-analytics.ts` with `mergeDailyViews()`, `computePreviousWeekStats()`, `computePeriodAggregates()`, and `runUpdateAnalytics()`. Registered as CLI command in `src/cli.ts`. All 224 existing tests pass.

- [ ] Implement inline analytics display on bid issues:
  - Update `src/lib/issue-template.ts`:
    - `generateStatsSection(analytics: AnalyticsData): string` — generates markdown for the "Previous Period Stats" section:
      - Format: "📊 **Previous BidMe sponsorship garnered {views} views, {clicks} clicks** ({ctr}% CTR)"
      - If no previous data, show: "📊 *First bidding period — no previous stats yet*"
      - Include a small note: "Stats based on the previous full week of sponsorship"
    - Update `generateBidIssueBody()` to include this stats section prominently near the top
    - Update `updateBidIssueBody()` to refresh stats when issue body is updated (e.g., when new bids come in)
  - Update `src/commands/open-bidding.ts` to read analytics data and pass previous stats to the issue template

- [ ] Build the image and content enforcement system:
  - `src/lib/content-enforcer.ts`:
    - `validateBannerImage(url: string, config: BidMeConfig): Promise<ValidationResult>`:
      - Fetch the image via HEAD request to check Content-Length (must be under `config.banner.max_size` KB)
      - Check Content-Type matches allowed formats (map `config.banner.formats` array to MIME types: png→image/png, jpg→image/jpeg, svg→image/svg+xml, gif→image/gif, webp→image/webp)
      - If possible, fetch the image and check pixel dimensions against `config.banner.width` and `config.banner.height` (for raster images only — skip for SVG)
      - Return detailed validation errors: "Image is 450KB, max allowed is 200KB", "Image is 1200x300, max allowed is 800x100", "Format .bmp is not in allowed formats: png, jpg, svg"
    - `validateCommentFormat(body: string): ValidationResult`:
      - Check that the comment contains a properly formatted YAML code block
      - Check that all required fields are present (amount, banner_url, destination_url, contact)
      - Check for disallowed content (config.content_guidelines.prohibited keywords — simple substring match)
      - Return specific error messages for each violation
    - `enforceContent(bid: ParsedBid, config: BidMeConfig): Promise<{ passed: boolean, errors: string[] }>`:
      - Runs both image validation and content guidelines check
      - Returns aggregated errors
  - Update `src/commands/process-bid.ts`:
    - After parsing the bid, run `enforceContent()` before accepting
    - If enforcement fails, reject the bid with specific error messages posted as a comment
    - Format rejection nicely: "❌ **Bid rejected — content requirements not met**\n\n- Image is too large (450KB > 200KB max)\n- Image dimensions exceed maximum (1200x300 > 800x100)"

- [ ] Stub the daily recap email system (defer full implementation):
  - `src/commands/daily-recap.ts`:
    - Reads analytics data from `.bidme/data/analytics.json`
    - Generates a summary: total views today, clicks today, active bids, current highest bid
    - For now: outputs the recap to stdout (console.log) as a formatted summary
    - Add a TODO comment: "Future: send this via GitHub Actions email or integrate with email service"
    - Register as CLI command: `bidme daily-recap` in `src/cli.ts`
  - Add `templates/workflows/bidme-daily-recap.yml`:
    - Triggers: `schedule` cron `0 8 * * *` (daily at 8am UTC)
    - Steps: checkout, setup-bun, `bun x bidme daily-recap`
    - Comment in workflow: "Currently outputs to Actions log. Future: email integration."

- [ ] Write tests for analytics and content enforcement:
  - `src/lib/__tests__/content-enforcer.test.ts`:
    - Test image size validation (pass and fail cases)
    - Test image format validation (allowed and disallowed)
    - Test comment format validation (valid YAML, missing fields, malformed)
    - Test content guidelines enforcement (prohibited keyword detection)
    - Test combined enforceContent() aggregates errors correctly
  - `src/commands/__tests__/analytics.test.ts`:
    - Test analytics data merge logic (dedup daily views, keep highest)
    - Test previousWeekStats computation
    - Test stats section markdown generation
    - Test empty/missing analytics data produces graceful output

- [ ] Run all analytics and enforcement tests and fix any failures.
