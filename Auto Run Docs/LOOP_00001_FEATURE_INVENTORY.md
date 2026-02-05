# Feature Inventory - Loop 00001

## README Analysis

### README Location
`/Users/dan/Projects/bidme/README.md`

### README Structure
| Section | Description | Line Numbers |
|---------|-------------|--------------|
| Title + Tagline | "BidMe — Auction-Based README Sponsorships" intro | 1-2 |
| Banner Placeholder | BIDME:BANNER HTML comment markers with badge | 5-7 |
| Quick Start | `bunx bidme init` / `npx bidme init` one-liner | 9-15 |
| How It Works | 4-step overview (Init, Bidding Opens, Bids Come In, Winner Goes Live) | 17-23 |
| Configuration | Full `config.toml` example with all sections | 25-52 |
| Commands | Table of 8 CLI commands | 54-66 |
| Payment Setup | Polar.sh integration steps (3-step) | 68-74 |
| For Advertisers | Bid YAML format and field reference table | 76-99 |
| License | MIT | 101-103 |

### Features Documented in README
| Feature | Section | Description in README |
|---------|---------|----------------------|
| `bidme init` | Quick Start / Commands | Interactive setup wizard — scaffolds config, workflows, and README banner |
| `bidme update` | Commands | Upgrade an existing BidMe installation (runs migrations) |
| `bidme open-bidding` | Commands | Open a new bidding period (creates pinned GitHub Issue) |
| `bidme close-bidding` | Commands | Close the active period — select winner, update README, archive |
| `bidme process-bid` | Commands | Validate and process a bid comment |
| `bidme process-approval` | Commands | Process owner's emoji approval on a bid |
| `bidme check-grace` | Commands | Check grace periods for unlinked bidders |
| `bidme update-analytics` | Commands | Fetch GitHub traffic data and update analytics |
| `bidme daily-recap` | Commands | Generate a daily recap of analytics and bidding activity |
| TOML Configuration | Configuration | `.bidme/config.toml` with bidding, banner, approval, payment, content_guidelines sections |
| Polar.sh Payment | Payment Setup | Payment processing via Polar.sh with POLAR_ACCESS_TOKEN secret |
| Bid YAML Format | For Advertisers | Structured bid comment format (amount, url, banner_url, alt_text, contact) |
| Emoji Approval | How It Works / Configuration | Owner approves winning bid with an emoji reaction |
| GitHub Actions Workflows | How It Works | Cron-triggered workflow creates pinned issue; automated bid validation |
| Banner Placeholder | How It Works | `bidme init` inserts BIDME:BANNER markers into README |
| Content Guidelines | Configuration | Prohibited/required content rules for banner submissions |

---

## Codebase Analysis

### Project Type
- **Language/Framework:** TypeScript / Bun runtime
- **Application Type:** CLI tool (distributed via npm/bunx)
- **Build System:** Bun bundler (`bun build src/cli.ts`)
- **Test Framework:** Bun test (`bun test`)
- **CLI Framework:** Commander.js + @clack/prompts (interactive wizard)

### Features Found in Code
| Feature | Location | Type | User-Facing? |
|---------|----------|------|--------------|
| `bidme init` (interactive wizard) | `src/commands/init.ts` | CLI | Yes |
| `bidme init --defaults` (skip prompts) | `src/cli.ts:27-28` | CLI | Yes |
| `bidme init --target <path>` | `src/cli.ts:27` | CLI | Yes |
| `bidme update` (migration runner) | `src/commands/update.ts` | CLI | Yes |
| `bidme open-bidding` | `src/commands/open-bidding.ts` | CLI | Yes |
| `bidme close-bidding` | `src/commands/close-bidding.ts` | CLI | Yes |
| `bidme process-bid <issue> <comment>` | `src/commands/process-bid.ts` | CLI | Yes |
| `bidme process-approval <issue> <comment>` | `src/commands/process-approval.ts` | CLI | Yes |
| `bidme check-grace` | `src/commands/check-grace.ts` | CLI | Yes |
| `bidme update-analytics` | `src/commands/update-analytics.ts` | CLI | Yes |
| `bidme daily-recap` | `src/commands/daily-recap.ts` | CLI | Yes |
| `bidme --version` / `-v` | `src/cli.ts:21` | CLI | Yes |
| TOML config load/save/validate | `src/lib/config.ts` | Config | Yes |
| Config validation with error messages | `src/lib/config.ts:110-193` | Config | Yes |
| `[enforcement]` config section | `src/lib/config.ts:28-31` | Config | Yes |
| `[tracking]` config section (UTM params) | `src/lib/config.ts:32-35` | Config | Yes |
| `approval.mode = "auto"` option | `src/lib/config.ts:17-19` | Config | Yes |
| `payment.allow_unlinked_bids` option | `src/lib/config.ts:24` | Config | Yes |
| `payment.unlinked_grace_hours` option | `src/lib/config.ts:25` | Config | Yes |
| `payment.bidme_fee_percent` option | `src/lib/config.ts:27` | Config | Yes |
| Scaffold `.bidme/` directory | `src/lib/scaffold.ts` | CLI (init) | Yes |
| GitHub Actions workflow templates (7 files) | `templates/workflows/` | Config | Yes |
| Redirect page for click tracking | `templates/redirect.html` | Config | Yes |
| README banner placeholder injection | `src/lib/scaffold.ts:146-164` | CLI (init) | Yes |
| Bid YAML comment parsing | `src/lib/validation.ts:20-44` | Internal | Indirect |
| Bid validation (amount, URLs, contact) | `src/lib/validation.ts:46-107` | Internal | Indirect |
| Banner image validation (size, format, dimensions) | `src/lib/content-enforcer.ts:14-84` | Internal | Indirect |
| Content guidelines enforcement (prohibited keywords) | `src/lib/content-enforcer.ts:175-198` | Internal | Indirect |
| Polar.sh API integration (products, checkouts, status) | `src/lib/polar-integration.ts` | Internal | Indirect |
| `bidme-managed` payment mode (future Stripe Connect) | `src/lib/polar-integration.ts:63-69` | Config | Yes |
| Bidder registry (payment linking, grace period tracking) | `src/lib/bidder-registry.ts` | Internal | Indirect |
| GitHub API client (issues, comments, reactions, traffic, PRs) | `src/lib/github-api.ts` | Internal | Indirect |
| Issue template generation (bid tables, winner announcements) | `src/lib/issue-template.ts` | Internal | Indirect |
| Badge generation (views, countries, CTR) | `src/lib/badge-generator.ts` | Internal | Indirect |
| Analytics store (views, clicks, CTR, periods) | `src/lib/analytics-store.ts` | Internal | Indirect |
| Error handling with typed error codes | `src/lib/error-handler.ts` | Internal | No |
| Retry logic for API calls | `src/lib/error-handler.ts:62-83` | Internal | No |
| Migration system (version tracking, incremental upgrades) | `src/lib/migrations/` | Internal | Indirect |
| Legacy install detection (`bidme-config.yml`) | `src/commands/update.ts:51-54` | Internal | Indirect |
| Git repo auto-detection (owner/repo from .git/config) | `src/lib/scaffold.ts:49-82` | Internal | Indirect |
| Issue pinning/unpinning via GraphQL | `src/lib/github-api.ts:135-157` | Internal | Indirect |
| README update via GitHub API (base64 commit) | `src/lib/github-api.ts:251-270` | Internal | Indirect |

---

## Feature Summary

### Totals
- **Features in README:** 16
- **Features in Code:** 38
- **Potential Gaps:** 10 (code features not in README)
- **Potential Stale:** 1 (README features not fully matching code)

### Quick Classification

#### Likely Undocumented (in code, not in README)
1. `--defaults` flag on `bidme init` — skip interactive prompts and use all defaults
2. `--target <path>` flag — available on all commands, lets you specify a different project directory
3. `--version` / `-v` flag — prints the current version
4. `[enforcement]` config section — `require_payment_before_bid` and `strikethrough_unlinked` settings
5. `[tracking]` config section — `append_utm` and `utm_params` for UTM tracking on bid links
6. `approval.mode = "auto"` — auto-accept all bids (README only shows "emoji")
7. `payment.allow_unlinked_bids` — allows bids from users without linked Polar accounts
8. `payment.unlinked_grace_hours` — configurable grace period for unlinked bidders
9. `payment.bidme_fee_percent` — configurable fee percentage (README mentions it but only as a static value)
10. Click tracking via `redirect.html` — GitHub Pages redirect page for tracking banner clicks

#### Possibly Stale (in README, not found in code)
1. Bid YAML field `alt_text` — README documents `alt_text` as a required bid field, but `src/lib/validation.ts` parses `amount`, `banner_url`, `destination_url`, `contact` (no `alt_text`). The README also uses `url` for destination but code uses `destination_url`.

#### Confirmed Documented (in both)
1. `bidme init` — accurate (wizard scaffolds config, workflows, README banner)
2. `bidme update` — accurate (runs migrations, upgrades config)
3. `bidme open-bidding` — accurate (creates pinned GitHub issue)
4. `bidme close-bidding` — accurate (selects winner, updates README, archives)
5. `bidme process-bid <issue> <comment>` — accurate
6. `bidme process-approval <issue> <comment>` — accurate
7. `bidme check-grace` — accurate
8. `bidme update-analytics` — accurate
9. `bidme daily-recap` — accurate
10. TOML config (bidding, banner, approval sections) — mostly accurate, but README is incomplete
11. Polar.sh payment integration — accurate
12. Content guidelines — accurate
13. Emoji approval mode — accurate
14. GitHub Actions workflows — accurate (7 workflow templates shipped)

#### Notable Discrepancies
1. **Bid format mismatch:** README shows `url` field; code expects `destination_url`. README shows `alt_text` as required; code does not parse or validate `alt_text`.
2. **Config incomplete in README:** README shows only `[bidding]`, `[banner]`, `[approval]`, `[payment]`, `[content_guidelines]`. Missing `[enforcement]` and `[tracking]` sections entirely.
3. **Payment config simplified:** README shows `bidme_fee_percent = 10` but doesn't mention `allow_unlinked_bids`, `unlinked_grace_hours`, or `payment_link` options.
