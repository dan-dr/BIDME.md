# Phase 03: GitHub Actions Workflows & Payment Integration

This phase wires everything together with GitHub Actions workflows that automate the full bidding lifecycle, and integrates Polar.sh for payment processing. After this phase, BidMe is a fully deployable GitHub Action that any repo owner can install — bids open on schedule as pinned issues, get processed automatically, owners approve via emoji, winners get their banner placed, and payments flow through Polar.sh.

## Tasks

- [x] Create the Polar.sh payment integration utility:
  - Create `scripts/utils/polar-integration.ts` with a `PolarAPI` class:
    - `createCheckoutSession(amount, bidderEmail, periodId)` — creates a Polar.sh checkout link for the winning bid amount. Uses the Polar.sh API (`https://api.polar.sh/v1/`) with `POLAR_ACCESS_TOKEN` from environment
    - `getPaymentStatus(checkoutId)` — checks if a checkout session has been paid
    - `createProduct(name, price, description)` — creates a one-time product on Polar.sh for the bidding period (e.g., "Banner Space: Jan 15-22, 2026 - $100")
  - Use fetch with proper error handling and typed responses
  - Include a `PolarConfig` type and graceful fallback when `POLAR_ACCESS_TOKEN` is not set (log warning, skip payment step)

- [x] Create the scheduled bid opening workflow:
  - Create `.github/workflows/schedule-bidding.yml`:
    - Trigger: `schedule` with cron expression (default monthly: `0 0 1 * *`), plus `workflow_dispatch` for manual trigger
    - Permissions: `contents: write`, `issues: write`
    - Steps: checkout repo, setup Bun, install dependencies, run `bun run scripts/bid-opener.ts`
    - Pass `GITHUB_TOKEN` as environment variable

- [x] Create the bid processing workflow:
  - Create `.github/workflows/process-bid.yml`:
    - Trigger: `issue_comment` with types `[created]`, filtered to issues with the `bidme` label (check `github.event.issue.labels`)
    - Condition: only run if comment body contains the bid YAML frontmatter markers (`---`), and the issue is NOT a pull request (check `!github.event.issue.pull_request`)
    - Permissions: `contents: write`, `issues: write`
    - Steps: checkout repo, setup Bun, install dependencies, run `bun run scripts/bid-processor.ts -- --issue=${{ github.event.issue.number }} --comment=${{ github.event.comment.id }}`
    - Pass `GITHUB_TOKEN`

- [x] Create the bid approval workflow:
  - Create `.github/workflows/process-approval.yml`:
    - Trigger: `issue_comment` with types `[edited]` (reaction events), plus workflow dispatch with issue number and comment ID inputs for manual processing
    - Condition: only process if the reactor is the repository owner, and the issue has the `bidme` label
    - Permissions: `contents: write`, `issues: write`
    - Steps: checkout repo, setup Bun, install dependencies, run `bun run scripts/approval-processor.ts -- --issue=${{ github.event.issue.number }} --comment=${{ github.event.comment.id }}`
  - ✅ Completed: Workflow created with `issue_comment[edited]` trigger + `workflow_dispatch` with inputs. Uses positional args matching approval-processor.ts CLI interface. Tests: 24 pass in `tests/workflows/process-approval.test.ts`.

- [x] Create the bid closing workflow:
  - Create `.github/workflows/close-bidding.yml`:
    - Trigger: `schedule` (runs daily, checks if current period has ended), plus `workflow_dispatch` for manual close
    - Permissions: `contents: write`, `issues: write`
    - Steps: checkout repo, setup Bun, install dependencies, run `bun run scripts/bid-closer.ts`
    - Pass both `GITHUB_TOKEN` and `POLAR_ACCESS_TOKEN`
    - After bid-closer runs, commit any data file changes and push
  - ✅ Completed: Workflow created with daily cron schedule (`0 0 * * *`) + `workflow_dispatch`. Includes commit-and-push step that only commits when data files change (`git diff --staged --quiet ||`). Tests: 18 pass in `tests/workflows/close-bidding.test.ts`. Full suite: 240/240 pass.

- [x] Update the bid closer script to integrate Polar.sh payment flow:
  - Modify `scripts/bid-closer.ts` to add payment processing after selecting winner:
    - Call `PolarAPI.createProduct()` to create a product for this bidding period
    - Call `PolarAPI.createCheckoutSession()` with the winning bid amount and bidder email
    - Include the Polar.sh checkout link in the winner announcement comment on the issue
    - Store the checkout URL and payment status in the archived period data
    - If Polar.sh is not configured (no token), skip payment and note it in the closing comment
  - ✅ Completed: Integrated PolarAPI into bid-closer.ts with `processPayment()` helper. Added `payment` field to PeriodData type. Updated `generateWinnerAnnouncement` to accept optional checkout URL. Tests: 248/248 pass (8 new Polar.sh integration tests in `tests/bid-closer.test.ts`).

- [x] Create a setup/installation script for new adopters:
  - Create `scripts/setup.ts` that:
    - Checks if `bidme-config.yml` exists, creates one from defaults if not
    - Checks if README has the `<!-- BIDME:BANNER:START -->` markers, adds them if not
    - Validates that required GitHub secrets are mentioned (prints checklist of: `POLAR_ACCESS_TOKEN` — optional but recommended)
    - Creates the `data/` directory if it doesn't exist
    - Prints a summary of what was set up and next steps
  - ✅ Completed: Created `scripts/setup.ts` with exported `setup()` function and CLI entry point. Creates config from defaults, adds banner markers to README (or creates README), ensures `data/` and `data/archive/` dirs, prints secrets checklist and next steps summary. Tests: 259/259 pass (11 new in `tests/setup.test.ts`).

- [x] Write tests for the Polar.sh integration module:
  - Create `scripts/__tests__/polar-integration.test.ts`:
    - Test `createCheckoutSession()` with mocked fetch responses
    - Test `getPaymentStatus()` with paid and unpaid states
    - Test graceful fallback when POLAR_ACCESS_TOKEN is not set
  - Run `bun test` and fix any failures
  - ✅ Completed: Tests already existed at `scripts/__tests__/polar-integration.test.ts` with 12 tests covering all required scenarios: createCheckoutSession (correct params, unconfigured throw, API error), getPaymentStatus (succeeded/open/expired states), createProduct, graceful fallback with no token, non-JSON error handling, and authorization headers. Full suite: 259/259 pass.
