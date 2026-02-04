![Build Status](https://img.shields.io/github/actions/workflow/status/danhollick/bidme/ci.yml?branch=main&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-22c55e?style=flat-square)
![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)

<!-- BIDME:BANNER:START -->
[![BidMe Banner](https://img.shields.io/badge/Your_Ad_Here-BidMe-22c55e?style=for-the-badge&logoColor=white)](https://github.com/danhollick/bidme)
<!-- BIDME:BANNER:END -->

# BidMe

**Automated banner bidding for GitHub READMEs.**

Turn your repo's README into sponsorship space. BidMe runs entirely on GitHub Actions — sponsors bid via issue comments, you approve with a reaction, and payment flows through Polar.sh. No servers, no databases, just GitHub.

## Features

- **Zero Infrastructure** — Runs 100% on GitHub Actions, Issues, and Pages
- **Transparent Bidding** — All bids are public issue comments; highest bid wins
- **One-Click Approval** — Approve the winning bid with an emoji reaction
- **Automated Payments** — Integrated with Polar.sh for seamless payment processing
- **Analytics Dashboard** — Track views, clicks, countries, and referrers via GitHub Pages
- **Content Guidelines** — Built-in validation for banner format, size, and content policies
- **Configurable Schedule** — Weekly or monthly bidding periods with customizable durations
- **Error Resilient** — Retry logic, graceful degradation, and structured error logging

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Run the setup wizard
bun run setup

# 3. Enable GitHub Actions in your repository settings
```

That's it. The setup script detects your Git repo, copies workflow files, creates data directories, and tells you what's left to configure manually (like adding `POLAR_ACCESS_TOKEN` to your repo secrets).

## How It Works

```
                         BidMe Lifecycle
 ┌──────────────────────────────────────────────────────┐
 │                                                      │
 │  Schedule          Pinned Issue        Bids          │
 │  (monthly/weekly)  created on GitHub   via comments  │
 │       │                 │                  │         │
 │       ▼                 ▼                  ▼         │
 │  ┌─────────┐     ┌────────────┐    ┌────────────┐   │
 │  │ Opener  │────▶│  Bidding   │───▶│ Processor  │   │
 │  │ Script  │     │  Issue     │    │ Validates  │   │
 │  └─────────┘     └────────────┘    │ & Ranks    │   │
 │                                    └─────┬──────┘   │
 │                                          │          │
 │  ┌─────────┐     ┌────────────┐          │          │
 │  │ Banner  │◀────│  Approval  │◀─────────┘          │
 │  │ Updated │     │  (emoji)   │    Owner reacts     │
 │  └────┬────┘     └────────────┘                     │
 │       │                                             │
 │       ▼                                             │
 │  ┌─────────┐     ┌────────────┐                     │
 │  │ Closer  │────▶│  Payment   │  via Polar.sh       │
 │  │ Script  │     │  Processed │                     │
 │  └─────────┘     └────────────┘                     │
 │                                                      │
 └──────────────────────────────────────────────────────┘
```

1. **Open** — A cron schedule (1st of each month or weekly) triggers `bid-opener`, which creates a pinned GitHub Issue for the new bidding period.
2. **Bid** — Sponsors comment on the issue with a YAML-formatted bid. `bid-processor` validates the amount, URL, banner specs, and content guidelines, then updates the bid table.
3. **Approve** — The repo owner reviews bids and reacts to the winning bid comment. `approval-processor` marks the bid as approved.
4. **Close** — When the period ends, `bid-closer` updates the README banner, archives the period data, processes payment via Polar.sh, and closes the issue.
5. **Track** — `analytics-updater` runs every 6 hours, fetching traffic data and updating the GitHub Pages dashboard.

## Configuration

BidMe is configured via `bidme-config.yml` in your project root:

```yaml
bidding:
  schedule: "monthly"    # "monthly" or "weekly"
  duration: 7            # Bidding period length in days
  minimum_bid: 50        # Minimum bid amount in USD
  increment: 5           # Minimum bid increment in USD

banner:
  width: 800             # Banner width in pixels
  height: 100            # Banner height in pixels
  format: "png,jpg,svg"  # Accepted image formats
  max_size: 200          # Maximum file size in KB
  position: "top"        # "top" or "bottom" of README

content_guidelines:
  prohibited:
    - "adult content"
    - "gambling"
    - "misleading claims"
  required:
    - "alt text"
    - "clear branding"

analytics:
  display: true          # Show analytics badges in README
  metrics:
    - views              # Total page views
    - countries          # Unique visitor countries
    - referrers          # Traffic sources
    - clicks             # Banner click tracking
```

## GitHub Pages Dashboard

BidMe includes a built-in analytics dashboard served via GitHub Pages. It displays:

- **Views & Uniques** — Daily traffic trends for your repo
- **Click-Through Rate** — How often visitors click the sponsor banner
- **Top Countries** — Geographic breakdown of your audience
- **Referrers** — Where your traffic comes from

Enable GitHub Pages (Settings → Pages → Source: `main`, folder: `/pages`) to activate the dashboard. Analytics data is updated automatically every 6 hours by the `update-analytics` workflow.

The dashboard is available at `https://<username>.github.io/<repo>/dashboard.html`.

## Payment Setup

BidMe uses [Polar.sh](https://polar.sh) for payment processing.

1. Create a Polar.sh account and set up your organization
2. Generate an access token from your Polar dashboard
3. Add `POLAR_ACCESS_TOKEN` as a [repository secret](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) in your GitHub repo (Settings → Secrets and variables → Actions)

When a bidding period closes with an approved winner, BidMe automatically creates a Polar checkout link and processes the payment. The `bid-closer` workflow handles retries and graceful failure if the payment API is temporarily unavailable.

## For Advertisers

To submit a bid, comment on the active bidding issue with this format:

```yaml
---
bid:
  amount: 100
  url: "https://yourcompany.com"
  banner_url: "https://yourcompany.com/banner.png"
  alt_text: "YourCompany - Build faster with our tools"
  contact: "sponsor@yourcompany.com"
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Bid amount in USD (must meet minimum) |
| `url` | Yes | Click-through destination URL |
| `banner_url` | Yes | URL to your banner image (800x100, max 200KB) |
| `alt_text` | Yes | Accessible description of your banner |
| `contact` | Yes | Email for bid communications |

Your bid is validated automatically. If it meets all requirements (minimum amount, valid URLs, acceptable banner format, content guidelines), it appears in the bid table. The highest approved bid at period close wins.

## Architecture

```
bidme/
├── .github/workflows/       # GitHub Actions automation
│   ├── schedule-bidding.yml  #   Monthly/weekly cron → opens bidding
│   ├── process-bid.yml       #   Issue comment → validates & processes bid
│   ├── process-approval.yml  #   Comment edit → marks bid approved
│   ├── close-bidding.yml     #   Daily cron → closes expired periods
│   └── update-analytics.yml  #   6-hour cron → fetches traffic data
├── scripts/                  # Core logic (TypeScript, runs via Bun)
│   ├── bid-opener.ts         #   Creates bidding issues
│   ├── bid-processor.ts      #   Validates and ranks bids
│   ├── bid-closer.ts         #   Closes periods, updates README, pays out
│   ├── approval-processor.ts #   Handles owner approval reactions
│   ├── analytics-updater.ts  #   Fetches & stores traffic analytics
│   ├── setup.ts              #   First-time project setup
│   ├── demo.ts               #   Demonstrates the bidding workflow
│   └── utils/                #   Shared utilities
│       ├── config.ts          #     Config loader with defaults
│       ├── validation.ts      #     Bid parsing & validation
│       ├── github-api.ts      #     GitHub API wrapper
│       ├── badge-generator.ts #     SVG badge generation
│       ├── issue-template.ts  #     Issue markdown templates
│       ├── analytics-store.ts #     Analytics data persistence
│       ├── error-handler.ts   #     Retry logic & error classes
│       └── polar-integration.ts #   Polar.sh payment API
├── pages/                    # GitHub Pages dashboard
│   ├── index.html            #   Landing page
│   ├── dashboard.html        #   Analytics dashboard
│   └── assets/               #   CSS & JS for dashboard
├── data/                     # Runtime data (gitignored)
├── bidme-config.yml          # Project configuration
└── package.json              # Scripts & dependencies
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run setup` | First-time setup — copies workflows, creates data dirs |
| `bun run demo` | Run a demonstration of the bidding workflow |
| `bun run open-bidding` | Manually open a new bidding period |
| `bun run close-bidding` | Manually close the current bidding period |
| `bun run update-analytics` | Manually refresh analytics data |
| `bun test` | Run the full test suite |
| `bun run typecheck` | Run TypeScript type checking |

## Built With

- [Bun](https://bun.sh) — JavaScript runtime and toolkit
- [GitHub Actions](https://github.com/features/actions) — Workflow automation
- [GitHub Pages](https://pages.github.com) — Analytics dashboard and redirect tracking
- [Polar.sh](https://polar.sh) — Payment processing

## License

[MIT](LICENSE)
