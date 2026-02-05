# Phase 05: GitHub Actions Workflows & Redirect System

This phase creates the production GitHub Actions workflow templates that ship with BidMe, builds the click-tracking redirect system with UTM parameter injection, and ensures all workflows use the published `bidme` package via `bun x bidme <command>`. It also removes the old `scripts/` directory and `pages/` dashboard since those are replaced by the new architecture.

## Tasks

- [x] Rewrite all GitHub Actions workflow templates in `templates/workflows/`:
  - `templates/workflows/bidme-schedule.yml`:
    - Triggers: `schedule` cron (configurable — default `0 0 1 * *` for monthly) + `workflow_dispatch` for manual
    - Steps: checkout, setup-bun, `bun x bidme open-bidding`
    - Permissions: contents write, issues write
    - Env: `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
  - `templates/workflows/bidme-process-bid.yml`:
    - Triggers: `issue_comment` created, filtered: not a PR, comment contains `---`, issue has `bidme` label
    - Steps: checkout, setup-bun, `bun x bidme process-bid ${{ github.event.issue.number }} ${{ github.event.comment.id }}`
    - Permissions: contents write, issues write
    - Env: `GITHUB_TOKEN`, `POLAR_ACCESS_TOKEN` (optional)
  - `templates/workflows/bidme-process-approval.yml`:
    - Triggers: `issue_comment` edited (reaction added triggers comment edit event)
    - Steps: checkout, setup-bun, `bun x bidme process-approval ${{ github.event.issue.number }} ${{ github.event.comment.id }}`
    - Permissions: contents write, issues write
  - `templates/workflows/bidme-close-bidding.yml`:
    - Triggers: `schedule` cron `0 0 * * *` (daily check) + `workflow_dispatch`
    - Steps: checkout, setup-bun, `bun x bidme close-bidding`
    - Permissions: contents write, issues write
    - Env: `GITHUB_TOKEN`, `POLAR_ACCESS_TOKEN`
  - `templates/workflows/bidme-check-grace.yml` (new):
    - Triggers: `schedule` cron `0 */6 * * *` (every 6 hours)
    - Steps: checkout, setup-bun, `bun x bidme check-grace`
    - Permissions: contents write, issues write
  - `templates/workflows/bidme-analytics.yml`:
    - Triggers: `schedule` cron `0 */6 * * *` + `repository_dispatch` type `bidme-click` + `workflow_dispatch`
    - Steps: checkout, setup-bun, `bun x bidme update-analytics`
    - Permissions: contents write
    - Env: `GITHUB_TOKEN`
  - All workflows must use `oven-sh/setup-bun@v2` and `actions/checkout@v4`
  - All workflows commit data changes back to the repo using `stefanzweifel/git-auto-commit-action@v5` with message "chore(bidme): update data"

- [ ] Build the click-tracking redirect page:
  - `templates/redirect.html`:
    - A lightweight HTML page that extracts `dest`, `id`, and `ref` from URL query params
    - Appends `?source=bidme&repo={repo}` to the destination URL (or `&source=...` if dest already has query params)
    - Fires a `repository_dispatch` event to the repo's GitHub API with type `bidme-click` and payload `{ banner_id, referrer, timestamp }`
    - Shows a brief branded interstitial: "Redirecting via BidMe..." with BidMe branding
    - Auto-redirects after 1 second (or immediately if dispatch fails)
    - This file gets copied to `.bidme/redirect.html` during init and served via GitHub Pages or raw.githubusercontent.com
  - Update `src/lib/scaffold.ts` to copy `redirect.html` during init
  - Update init to inform users they should enable GitHub Pages on their repo if they want click tracking

- [ ] Remove old code that is fully replaced:
  - Delete `scripts/` directory entirely (all logic now lives in `src/`)
  - Delete `pages/` directory (dashboard.html, admin.html, index.html — no standalone dashboard in v2)
  - Delete `bidme-config.yml` from project root (replaced by `.bidme/config.toml`)
  - Delete `data/` directory from project root (replaced by `.bidme/data/`)
  - Delete `dist/` directory (will be rebuilt from `src/`)
  - Update `package.json` scripts to remove old references:
    - Remove: `setup`, `demo`, `open-bidding`, `close-bidding`, `update-analytics`
    - Keep: `test`, `typecheck`, `build`, `cli`
    - Add: `dev` script for local development
  - Update `.gitignore` if needed to ignore `dist/` but not `.bidme/data/`

- [ ] Update the init command to copy all workflow templates correctly:
  - Update `src/commands/init.ts` and `src/lib/scaffold.ts`:
    - During init, copy all 6 workflow files from `templates/workflows/` to target's `.github/workflows/`
    - Copy `templates/redirect.html` to target's `.bidme/redirect.html`
    - If a workflow file already exists in the target, skip it and log a message
    - The init wizard should show a summary of what was created at the end

- [ ] Write tests for workflow template validation:
  - `src/commands/__tests__/workflows.test.ts`:
    - Test all 6 workflow YAML files are valid YAML syntax
    - Test each workflow has required fields: `name`, `on`, `jobs`, `permissions`
    - Test all workflows reference `bun x bidme` commands (not local script paths)
    - Test init copies workflows to correct location
    - Test init doesn't overwrite existing workflows

- [ ] Run workflow tests and fix any failures. Then do a full smoke test: run `bun run cli init --defaults --target /tmp/bidme-full-test` and verify all files are created in the right places — `.bidme/config.toml`, `.bidme/data/*`, `.bidme/redirect.html`, `.github/workflows/bidme-*.yml`, and README.md with placeholder.
