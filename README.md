![Build Status](https://img.shields.io/github/actions/workflow/status/danhollick/bidme/ci.yml?branch=main&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-22c55e?style=flat-square)

<!-- BIDME:BANNER:START -->
[![BidMe Banner](https://img.shields.io/badge/Your_Ad_Here-BidMe-22c55e?style=for-the-badge&logoColor=white)](https://github.com/danhollick/bidme)
<!-- BIDME:BANNER:END -->

# BidMe

Automated README banner bidding system — let sponsors bid for banner space in your GitHub repo, powered entirely by GitHub Actions.

## How It Works

1. **Install** — Add BidMe to your repo with `bun install` and drop in `bidme-config.yml`
2. **Bids Come In** — Sponsors submit bids as PR comments using a simple YAML format
3. **Get Paid** — Approve the winning bid, and payment is processed through Polar.sh

## Quick Start

```bash
# Clone and install
git clone https://github.com/danhollick/bidme.git
cd bidme
bun install

# Configure bidding parameters
# Edit bidme-config.yml to set minimum bid, schedule, banner specs, etc.

# Enable GitHub Actions
# Push to GitHub and enable Actions in your repository settings
```

## Configuration

BidMe is configured via `bidme-config.yml` in your project root:

```yaml
bidding:
  schedule: "monthly"    # or "weekly"
  duration: 7            # bidding period in days
  minimum_bid: 50        # minimum bid in USD
  increment: 5           # minimum bid increment

banner:
  width: 800
  height: 100
  format: "png,jpg,svg"
  max_size: 200          # KB
  position: "top"        # or "bottom"
```

## Built With

- [Bun](https://bun.sh) — JavaScript runtime and toolkit
- [GitHub Actions](https://github.com/features/actions) — Workflow automation
- [GitHub Pages](https://pages.github.com) — Landing page and redirect tracking
- [Polar.sh](https://polar.sh) — Payment processing

## License

MIT
