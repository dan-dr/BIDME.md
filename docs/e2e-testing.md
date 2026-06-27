# BIDME End-to-End Testing Guide for AI Agents

This is the playbook an AI agent follows to validate the full BIDME flow against
a real GitHub repo + Stripe sandbox. It is the same path used to validate v0.4.0
on `dan-dr/bidme-test`.

## Prerequisites

| Requirement | How to verify |
|-------------|---------------|
| `gh` CLI authenticated with `repo`, `workflow` scopes | `gh auth status` |
| A throwaway test repo (e.g. `dan-dr/bidme-test`) | `gh repo view <owner>/<repo>` |
| `STRIPE_SECRET_KEY` (`sk_test_...`) set as a repo secret | `gh secret list --repo <repo>` |
| `BIDME_PAT` set as a repo secret (for Actions variable writes) | `gh secret list --repo <repo>` |
| "Allow GitHub Actions to create and approve pull requests" enabled (so the winner PR opens) | `gh api repos/<repo>/actions/permissions/workflow` → `can_approve_pull_request_reviews: true`, or set via UI Settings → Actions → General |
| GitHub Pages enabled on the test repo (main, `/`) | `gh api repos/<repo>/pages` |
| BIDME source checked out locally and on `origin/main` | `git log --oneline origin/main -1` |
| `agent-browser` available (for the Stripe checkout step) | `agent-browser --version` |
| A Stripe sandbox test card (`4242 4242 4242 4242`, any future expiry, any CVC) | Stripe docs |

> The test repo's workflows run `uses: dan-dr/BIDME.md@main`, so the action code
> must be on `main` before the workflows will use it.

> To enable PR creation via the API (one-time):
> `gh api -X PUT repos/<repo>/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true`

## Mental model

State lives in two GitHub Actions variables on the test repo:

- `BIDME_CURRENT_PERIOD` — the open period + its bids (cleared on close)
- `BIDME_ANALYTICS` — clicks, daily views, and closed-period summaries

Each runtime command is a GitHub Action invoked by a workflow. The agent's job is
to drive the workflows and then **verify the side effects** (variable, issue,
comment, README, Stripe charge) after each step.

## Step-by-step

Every step below has a **Trigger** and a **Verify**. Screenshot the GitHub UI
(issue, comment, Actions run, README) at each verify so the run is reproducible.

### 0. Reset the test repo to a clean state

```bash
cd /Users/dan/Projects
rm -rf bidme-test && gh repo clone dan-dr/bidme-test bidme-test
cd bidme-test
git rm -r --quiet .
gh variable delete BIDME_CURRENT_PERIOD --repo dan-dr/bidme-test || true
gh variable delete BIDME_ANALYTICS          --repo dan-dr/bidme-test || true
git commit -q -m "chore: wipe for fresh bidme init"
```

### 1. Fresh install

```bash
cd /Users/dan/Projects/bidme
bun run src/cli.ts init --defaults --target /Users/dan/Projects/bidme-test
```

**Verify:** `.bidme/config.toml` has no `[approval]` and has
`unlinked_grace_hours = 24`; `.github/workflows/` has 5 files including
`bidme-check-grace.yml`.

```bash
cd /Users/dan/Projects/bidme-test
git add -A && git commit -q -m "chore: fresh bidme init" && git push origin main
```

### 2. Open a bidding period

**Trigger:**
```bash
gh workflow run bidme-open.yml --repo dan-dr/bidme-test
```

**Verify (after ~20s):**
- `gh run list --workflow "BIDME: Open Bidding Period" --limit 1` → `success`
- A pinned issue exists: `gh issue list --state open`
- `gh variable get BIDME_CURRENT_PERIOD` → JSON with `status: "open"`, `issue_number`, empty `bids`

**Screenshot:** the pinned issue in the browser.

### 3. Submit a bid

**Trigger:** post a comment on the open issue containing `---`, `bid:`, and a
markdown banner image:
```bash
ISSUE=$(gh issue list --repo dan-dr/bidme-test --state open --json number --jq '.[0].number')
gh issue comment $ISSUE --repo dan-dr/bidme-test --body '---
bid:
  amount: 100
  destination_url: "https://example.com"
  tagline: "Build faster with test tools"
---

![Banner](https://placehold.co/800x100/22c55e/ffffff.png?text=Test+Sponsor)'
```

The `issue_comment` event fires `BIDME: Process Bid` automatically.

**Verify (after ~25s):**
- `gh run list --workflow "BIDME: Process Bid" --limit 1` → `success`
- `gh variable get BIDME_CURRENT_PERIOD` → one bid with `status: "unlinked_pending"`
- The bidder's comment was **edited in place** (not a new bot comment) with a
  `<!-- bidme-status -->` block containing a Stripe Checkout link and the grace
  window. Read it with:
  `gh api repos/dan-dr/bidme-test/issues/comments/<comment-id> --jq '.body'`

**Screenshot:** the edited comment showing the "Payment required" banner + Stripe link.

### 4. Complete the Stripe setup (save a test card)

Extract the checkout URL from the edited comment, then drive it with
`agent-browser`. Use the embedded desktop browser pane if available.

```bash
URL=$(gh api repos/dan-dr/bidme-test/issues/comments/<id> --jq '.body' \
      | grep -oE 'https://checkout\.stripe\.com/c/pay/[^)]+' | head -1)
agent-browser --cdp "$AGENT_BROWSER_CDP" open "$URL"
agent-browser --cdp "$AGENT_BROWSER_CDP" snapshot -i
```

Fill the card fields (Stripe hosts them in cross-origin iframes, so use
`focus` + `keyboard type` rather than `fill` for the card number/expiry/CVC):

```bash
agent-browser --cdp "$AGENT_BROWSER_CDP" focus @e17
agent-browser --cdp "$AGENT_BROWSER_CDP" keyboard type "4242424242424242"
agent-browser --cdp "$AGENT_BROWSER_CDP" focus @e18
agent-browser --cdp "$AGENT_BROWSER_CDP" keyboard type "1234"   # expiry
agent-browser --cdp "$AGENT_BROWSER_CDP" focus @e19
agent-browser --cdp "$AGENT_BROWSER_CDP" keyboard type "123"    # CVC
agent-browser --cdp "$AGENT_BROWSER_CDP" fill @e20 "Dan Test"   # cardholder
agent-browser --cdp "$AGENT_BROWSER_CDP" select @e21 "United States"
agent-browser --cdp "$AGENT_BROWSER_CDP" fill @e22 "94103"      # ZIP
agent-browser --cdp "$AGENT_BROWSER_CDP" click @e5              # Save / Pay
```

**Verify:** the browser redirects to
`https://dan-dr.github.io/bidme-test/.bidme/pay/stripe/success.html` and the
page reads "Payment method linked".

**Screenshot:** the Stripe Checkout form (filled) and the success page.

> Note: if the form re-renders after selecting the country, re-snapshot and use
> the new refs. If it hangs on "Processing", the iframe fill didn't take —
> re-open the URL and use `focus` + `keyboard type`.

### 5. Check the payment grace window

**Trigger:**
```bash
gh workflow run bidme-check-grace.yml --repo dan-dr/bidme-test
```

**Verify (after ~25s):**
- `gh run list --workflow "BIDME: Check Payment Grace" --limit 1` → `success`
- `gh variable get BIDME_CURRENT_PERIOD` → the bid's `status` is now `"active"`
- The bidder's comment was re-edited to "Bid active — $100 · Rank #1"

**Screenshot:** the re-edited comment showing the "Bid active" banner.

### 6. Close the bidding period

**Trigger:**
```bash
gh workflow run bidme-close.yml --repo dan-dr/bidme-test
```

**Verify (after ~35s):**
- `gh run list --workflow "BIDME: Close Bidding Period" --limit 1` → `success`
- Log shows `✓ Stripe payment successful: pi_...` (a real sandbox PaymentIntent)
- Log shows `✓ Opened PR #N: https://github.com/dan-dr/bidme-test/pull/N`
- `gh variable get BIDME_CURRENT_PERIOD` → `{}`
- The issue is `CLOSED` and unpinned
- `gh issue view <n> --json comments --jq '.comments[-1].body'` → winner announcement with a link to the PR
- `gh pr view <N> --repo dan-dr/bidme-test` → open PR titled `BIDME: Winning banner — @...`; the PR adds a banner file under `.bidme/banners/`, updates `README.md` (banner references the uploaded file, with a "view winning bid" link below), and adds the archive JSON
- `.bidme/data/archive/period-YYYY-MM-DD.json` is in the PR diff

**Screenshot:** the winner announcement comment, the PR (files changed), and the README banner preview on the PR.

> The winning banner is downloaded and committed into the repo (under
> `.bidme/banners/`), so the README references a local file, not an external
> host. Merge the PR to publish the banner to `main`.

### 7. Analytics (optional sanity check)

```bash
gh workflow run bidme-analytics.yml --repo dan-dr/bidme-test
```

**Verify:** run succeeds; `BIDME_ANALYTICS` variable is updated.

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Process Bid run `failure` with no comment edit | Workflow `if` not matched (no `bid:` / `---`, or issue lacks `bidme` label) | Confirm the comment body and that open-bidding labeled the issue |
| Bid stuck `unlinked_pending` after checkout | check-grace didn't find the payment method | Confirm the Stripe customer's `metadata.github_username` matches the bidder login; re-run check-grace |
| Close runs but no README commit | `git-auto-commit` step skipped (no diff) | Confirm the banner placeholder exists in README before close |
| `gh variable` writes 403 | `GITHUB_TOKEN` lacks Actions variable perms | `BIDME_PAT` secret must be set and present in the workflow env |
| Close log: "GitHub Actions is not permitted to create or approve pull requests" or "Resource not accessible by personal access token" | Neither `BIDME_PAT` nor `GITHUB_TOKEN` can open PRs | The action tries `BIDME_PAT` first, then `GITHUB_TOKEN`. Enable "Allow GitHub Actions to create and approve pull requests" in repo Settings → Actions → General (or use a PAT with `pull-requests: write` scope) |
| Stripe checkout stuck on "Processing" | iframe fill didn't register | Re-open the URL; use `focus` + `keyboard type` for card fields |

## Agent tips

- Keep mutating Actions calls **serial** — wait for each run to `completed`
  before triggering the next.
- Read variables with `gh variable get <NAME>` (the value is raw JSON on stdout).
- Read the edited bid comment with the REST API (`issues/comments/<id>`), not
  `gh issue view`, so you see the exact body the bot wrote.
- The bidder is whoever posts the comment; if you post as the repo owner, the
  Stripe customer must be keyed to that same login.
- Do not run `agent-browser close` when using the embedded desktop pane — it is
  owned by the Factory desktop app.
