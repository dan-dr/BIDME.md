# BidMe — Auction-Based README Sponsorships

Let companies bid for banner space in your README. Highest approved bid wins.

<!-- BIDME:BANNER:START -->
[![BidMe Banner](https://img.shields.io/badge/Your_Ad_Here-BidMe-22c55e?style=for-the-badge&logoColor=white)](https://github.com/danhollick/bidme)
<!-- BIDME:BANNER:END -->

## Quick Start

```bash
bunx bidme init    # or: npx bidme init
```

The interactive wizard handles the rest — config, workflows, README banner placeholder, everything.

## How It Works

1. **Init** — Run `bidme init` to scaffold `.bidme/` config, GitHub Actions workflows, and a banner placeholder in your README.
2. **Bidding Opens** — A cron-triggered workflow creates a pinned GitHub Issue for the new bidding period. Sponsors comment with their bid.
3. **Bids Come In** — Each bid is validated automatically (amount, banner format, content guidelines). You approve the winner with an emoji reaction.
4. **Winner Goes Live** — The period closes, the winning banner replaces the placeholder in your README, and payment is processed via Polar.sh.

## Configuration

BidMe stores its config in `.bidme/config.toml`:

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
mode = "emoji"             # Approve winning bid with a reaction
allowed_reactions = ["👍"]

[payment]
provider = "polar-own"
bidme_fee_percent = 10

[content_guidelines]
prohibited = ["adult content", "gambling", "misleading claims"]
required = ["alt text", "clear branding"]
```

## Commands

| Command | Description |
|---------|-------------|
| `bidme init` | Interactive setup wizard — scaffolds config, workflows, and README banner |
| `bidme update` | Upgrade an existing BidMe installation (runs migrations) |
| `bidme open-bidding` | Open a new bidding period (creates pinned GitHub Issue) |
| `bidme close-bidding` | Close the active period — select winner, update README, archive |
| `bidme process-bid <issue> <comment>` | Validate and process a bid comment |
| `bidme process-approval <issue> <comment>` | Process owner's emoji approval on a bid |
| `bidme check-grace` | Check grace periods for unlinked bidders |
| `bidme update-analytics` | Fetch GitHub traffic data and update analytics |
| `bidme daily-recap` | Generate a daily recap of analytics and bidding activity |

## Payment Setup

BidMe uses [Polar.sh](https://polar.sh) for payments.

1. Create a Polar.sh account and generate an access token
2. Add `POLAR_ACCESS_TOKEN` as a [repository secret](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) in your GitHub repo
3. Done — BidMe handles checkout links and payment processing automatically when a period closes

## For Advertisers

Comment on the active bidding issue with this format:

```yaml
---
bid:
  amount: 100
  destination_url: "https://yourcompany.com"
  banner_url: "https://yourcompany.com/banner.png"
  alt_text: "YourCompany - Build faster with our tools"
  contact: "sponsor@yourcompany.com"
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Bid amount in USD (must meet minimum) |
| `destination_url` | Yes | Click-through destination URL |
| `banner_url` | Yes | URL to your banner image (800×100, max 200KB) |
| `alt_text` | Yes | Accessible description of your banner |
| `contact` | Yes | Email for bid communications |

Your bid is validated automatically. If it meets all requirements, it enters the ranking. The highest approved bid at period close wins.

## License

[MIT](LICENSE)
