# BIDME — Auction-Based README Sponsorships

Let companies bid for banner space in your README. Highest approved bid wins.

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
3. **Bids Come In** — Each bid is validated automatically. Stripe customer metadata is the bidder source of truth.
4. **Winner Goes Live** — The period closes, the winner is charged, the README banner updates, and the period archive is committed.

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

[approval]
mode = "emoji"             # Repo owner approves with /approve @user
allowed_reactions = ["👍"]

[payment]
mode = "own_keys"          # "own_keys" or "connect"
bidme_fee_percent = 10
base_url = ""              # defaults to https://{owner}.github.io/{repo}/bidme

[content_guidelines]
prohibited = ["adult content", "gambling", "misleading claims"]
required = ["alt text", "clear branding"]
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `bidme init` | Interactive setup wizard — scaffolds config, workflows, and README banner |
| `bidme doctor` | Verify config, workflows, GitHub Pages, required secrets, and Stripe |
| `bidme update` | Upgrade an existing BIDME installation (runs migrations) |
| `bidme remove` | Remove BIDME files from a repository |

Runtime jobs (`open-bidding`, `process-bid`, `close-bidding`, `update-analytics`) run through the generated GitHub workflows using the BIDME GitHub Action.

## Payment Setup

BIDME uses [Stripe](https://stripe.com) for payments.

1. Create a Stripe account and generate a secret key from the [API keys page](https://dashboard.stripe.com/apikeys)
2. Add `STRIPE_SECRET_KEY` as a repository secret.
3. Enable GitHub Pages from the default branch root. Payment pages default to `https://{owner}.github.io/{repo}/bidme/stripe/`.
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

Your bid is validated automatically. If it meets all requirements and has a linked payment method, it enters the ranking. The repo owner can approve a pending bid with `/approve @username`. The highest approved bid at period close wins.

## License

[MIT](LICENSE)
