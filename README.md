# BIDME — Auction-Based README Sponsorships

Let companies bid for banner space in your README. Highest active bid wins.

<!-- bidme-banner-start -->
[![BIDME Banner](https://img.shields.io/badge/Your_Ad_Here-BIDME-22c55e?style=for-the-badge&logoColor=white)](https://github.com/dan-dr/BIDME.md)
<!-- bidme-banner-end -->

## Quick Start

```bash
bidme init
bidme doctor
```

> **Note:** BIDME is not yet published to npm. To run from source, clone the repo and use `bun run src/cli.ts init`.

The CLI scaffolds config, four GitHub Actions workflows, Stripe/redirect pages, and the README banner placeholder. The installed GitHub Action performs runtime automation.

## How It Works

1. **Init** — Run `bidme init` to scaffold `.bidme/` config, GitHub Actions workflows, and a banner placeholder in your README.
2. **Bidding Opens** — A cron-triggered workflow creates a pinned GitHub Issue for the new bidding period. Sponsors comment with their bid.
3. **Bids Come In** — Each bid is validated automatically. BIDME edits the bidder's own comment in place with a status banner: accepted (with rank), payment required (with a Stripe link), or rejected (with the reason). Stripe customer metadata is the bidder source of truth.
4. **Payment Grace** — A bid without a linked Stripe payment method is paused and given a grace window. A scheduled check activates it once the card is linked, or expires it when the window elapses.
5. **Winner Goes Live** — The period closes, the highest active bid is charged, the README banner updates, and the period archive is committed.

Runtime state lives in GitHub Actions variables:

| Variable | Purpose |
|----------|---------|
| `BIDME_CURRENT_PERIOD` | Open issue and bid state |
| `BIDME_ANALYTICS` | Clicks, views, and period summaries |

## Configuration

BIDME stores its config in `.bidme/config.toml`:

```toml
[bidding]
schedule = "monthly"       # "monthly" or "weekly"
duration = 7               # Bidding period length in days
minimum_bid = 50           # Minimum bid amount in USD
increment = 5              # Minimum bid increment in USD

[banner]
width = 800
height = 100
formats = ["png", "jpg", "svg"]
max_size = 200             # Max file size in KB

[payment]
mode = "own_keys"          # "own_keys" or "connect"
bidme_fee_percent = 10
unlinked_grace_hours = 24  # Hours an unlinked bid waits for a Stripe payment method
base_url = ""              # defaults to https://{owner}.github.io/{repo}/.bidme/pay/stripe

[content_guidelines]
prohibited = ["adult content", "gambling", "misleading claims"]
required = ["alt text", "clear branding"]
```

There is no manual approval step. A bid becomes **active** the moment its bidder
has a linked Stripe payment method, and the highest active bid at period close
wins. `content_guidelines.prohibited` are the owner's house rules (for example
`"crypto"`); bids matching them are rejected automatically. Owners who want to
decline a specific bid for any other reason can simply delete its comment.

## CLI Commands

| Command | Description |
|---------|-------------|
| `bidme init` | Interactive setup wizard — scaffolds config, workflows, and README banner |
| `bidme doctor` | Verify config, workflows, GitHub Pages, required secrets, and Stripe |
| `bidme update` | Upgrade an existing BIDME installation (runs migrations) |
| `bidme remove` | Remove BIDME files from a repository |

Runtime jobs (`open-bidding`, `process-bid`, `check-grace`, `close-bidding`, `update-analytics`) run through the generated GitHub workflows using the BIDME GitHub Action.

## Payment Setup

BIDME uses [Stripe](https://stripe.com) for payments.

1. Create a Stripe account and generate a secret key from the [API keys page](https://dashboard.stripe.com/apikeys)
2. Add `STRIPE_SECRET_KEY` as a repository secret.
3. Enable GitHub Pages from the default branch root. Payment pages default to `https://{owner}.github.io/{repo}/.bidme/pay/stripe/`. The generated `_config.yml` includes `.bidme` for Pages so Jekyll serves the nested pay files, and excludes config, version, data, and test files under `.bidme/`.
4. Optional fallback: add `BIDME_PAT` as a repository secret if GitHub rejects Actions variable writes from `GITHUB_TOKEN`. Use a fine-grained PAT or GitHub App token with repository Actions variables read/write.
5. Run `bidme doctor`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Your Stripe secret key (starts with `sk_`) |
| `GITHUB_TOKEN` | In Actions | Built-in workflow token used for GitHub issue and variable APIs |
| `BIDME_PAT` | Usually | Token for Actions variables when `GITHUB_TOKEN` is blocked by repo permissions |

## For Advertisers

Comment on the active bidding issue with this format:

```yaml
---
bid:
  amount: 100
  destination_url: "https://yourcompany.com"
  tagline: "Build faster with our tools"
---
```

Attach the banner image directly to the GitHub comment. GitHub hosts it and BIDME extracts the Markdown image URL.

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Bid amount in USD (must meet minimum) |
| `destination_url` | Yes | Click-through destination URL |
| `tagline` | Yes | Short accessible banner description |

Your bid is validated automatically and BIDME edits your comment with the result. If it meets all requirements and you have a linked Stripe payment method, it becomes **active** and enters the ranking immediately. If you have no payment method yet, your comment shows a Stripe link — authorize your card within the grace window and a scheduled check activates the bid. The highest active bid at period close wins.

## License

[MIT](LICENSE)
