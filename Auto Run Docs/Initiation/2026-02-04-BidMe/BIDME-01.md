# Phase 01: Foundation & Working Prototype

This phase sets up the entire BidMe project from scratch — initializing the Bun/TypeScript project, creating the full directory structure, writing the core configuration system, building utility modules, and delivering a working GitHub Pages site with a redirect tracker. By the end, you'll have a real project that installs, builds, and serves a functional landing page locally — proving the architecture works end-to-end.

## Tasks

- [x] Initialize the Bun/TypeScript project and create the full directory structure:
  - Run `bun init` in the project root with name "bidme"
  - Create all directories: `.github/workflows/`, `scripts/utils/`, `pages/assets/css/`, `pages/assets/js/`, `data/`
  - Create `tsconfig.json` with strict mode, ES2022 target, module NodeNext, and path aliases (`@scripts/*`, `@utils/*`)
  - Add a `.gitignore` with `node_modules/`, `dist/`, `.env`, `*.log`
  - Install dev dependencies: `@types/bun` (types only — Bun has built-in TypeScript support)
  > Completed: bun init with name "bidme", all directories created with .gitkeep files, tsconfig.json configured with ES2022/NodeNext/strict/path aliases, .gitignore covering all specified patterns, @types/bun@1.3.8 installed, git repo initialized.

- [x] Create the `bidme-config.yml` configuration file and its TypeScript loader:
  - Create `bidme-config.yml` at the project root with the full schema from the plan: bidding (schedule, duration, minimum_bid, increment), banner (width, height, format, max_size, position), content_guidelines (prohibited, required), analytics (display, metrics)
  - Create `scripts/utils/config.ts` that reads and parses `bidme-config.yml` using Bun's file API and a YAML parser (`js-yaml` — install it)
  - Export a typed `BidMeConfig` interface and a `loadConfig()` function
  - Include sensible defaults that merge with user-provided values
  > Completed: bidme-config.yml created with full schema, scripts/utils/config.ts implements typed BidMeConfig interface with loadConfig() using js-yaml, deepMerge for sensible defaults, 5 tests passing. No git remote configured — push skipped.

- [x] Build the validation utility module:
  - Create `scripts/utils/validation.ts` with functions:
    - `parseBidComment(body: string): ParsedBid | null` — extracts bid amount, banner_url, destination_url, contact from the YAML frontmatter format defined in the plan
    - `validateBid(bid: ParsedBid, config: BidMeConfig): ValidationResult` — checks minimum bid, increment rules, URL format, and contact format
    - `validateBannerUrl(url: string, config: BidMeConfig): Promise<ValidationResult>` — checks URL accessibility and format constraints
  - Export all types: `ParsedBid`, `ValidationResult`, `ValidationError`
  > Completed: validation.ts created with parseBidComment (YAML frontmatter extraction), validateBid (minimum/increment/URL/contact validation), validateBannerUrl (format + accessibility checks). All types exported. 19 new tests passing, 24 total across project.

- [x] Build the GitHub API utility module:
  - Create `scripts/utils/github-api.ts` with a `GitHubAPI` class that wraps the GitHub REST API using fetch (no external SDK):
    - `createPR(title, body, head, base)` — creates a pull request
    - `addComment(issueNumber, body)` — adds a comment to a PR
    - `updatePRBody(prNumber, body)` — updates PR description
    - `getComments(issueNumber)` — lists comments on a PR
    - `getReactions(commentId)` — gets reactions on a comment
    - `updateReadme(content, message)` — commits updated README content
  - Use `GITHUB_TOKEN` environment variable for authentication
  - Include proper error handling with typed error responses
  > Completed: GitHubAPI class created with all 6 methods using native fetch, Bearer token auth from GITHUB_TOKEN env var or constructor param, typed GitHubAPIError with status/message/documentation_url. updateReadme handles both create and update via Contents API sha. 13 new tests passing, 37 total across project.

- [x] Build the badge generator utility:
  - Create `scripts/utils/badge-generator.ts` with functions:
    - `generateViewsBadge(count: number): string` — returns shields.io markdown for view count
    - `generateCountriesBadge(count: number): string` — returns shields.io markdown for country count
    - `generateCTRBadge(rate: number): string` — returns shields.io markdown for click-through rate
    - `generateBannerSection(bannerUrl: string, destUrl: string, badges: string[]): string` — returns full markdown banner block with badges underneath
  - Format large numbers with K/M suffixes (e.g., 1200 → "1.2k")
  > Completed: badge-generator.ts created with formatNumber (K/M suffixes), generateViewsBadge (blue), generateCountriesBadge (green), generateCTRBadge (orange), generateBannerSection (linked banner + badge row). 14 new tests passing, 51 total across project. No git remote configured — push skipped.

- [x] Create the GitHub Pages landing page and redirect tracker:
  - Create `pages/index.html` — a clean landing page for BidMe explaining what it is, how it works (3-step flow: Install → Bids come in → Get paid), and a "Get Started" CTA linking to the GitHub repo. Use inline CSS with a modern dark theme, monospace headings, and green accent color (#22c55e)
  - Create `pages/redirect.html` — the click-tracking redirect page that reads `id` and `dest` query parameters, appends `ref` parameter to destination URL, logs the click timestamp to `localStorage` (placeholder for future analytics), and redirects the user. Include a fallback "Click here if not redirected" link
  - Create `pages/assets/css/style.css` with shared styles for dashboard and admin pages (CSS custom properties for theming, responsive grid, card components)
  > Completed: pages/index.html created with dark theme (#0a0a0a bg), monospace headings, green accent (#22c55e), 3-step flow (Install/Bids Come In/Get Paid), GitHub CTA. pages/redirect.html reads id/dest query params, appends ref=bidme, logs clicks to localStorage with timestamps, shows fallback link after 2s, handles missing/invalid dest gracefully. pages/assets/css/style.css provides CSS custom properties, responsive grid, card/badge/button/table/input components, layout utilities. 25 new tests passing, 76 total across project.

- [x] Create a demo script that exercises the core modules end-to-end:
  - Create `scripts/demo.ts` that:
    - Loads the config from `bidme-config.yml` using `loadConfig()`
    - Parses a sample bid comment string using `parseBidComment()`
    - Validates the parsed bid using `validateBid()`
    - Generates a sample banner section with badges using `generateBannerSection()`
    - Prints all results to stdout in a formatted way showing: config loaded ✓, bid parsed ✓, validation result, generated markdown output
  - This script should run successfully with `bun run scripts/demo.ts` and produce visible output proving the system works
  > Completed: scripts/demo.ts created — loads config, parses sample $100 bid from YAML comment, validates bid (passes), generates banner section with views (12.5k), countries (42), CTR (3.2%) badges. Outputs formatted results with ✓ markers. 4 new integration tests in tests/demo.test.ts, 80 total tests passing across project.

- [x] Create a project README.md with the BidMe banner placeholder:
  - Create `README.md` with:
    - A `<!-- BIDME:BANNER:START -->` / `<!-- BIDME:BANNER:END -->` comment block where the winning banner will be inserted
    - A placeholder banner image using shields.io: `![BidMe Banner](https://img.shields.io/badge/Your_Ad_Here-BidMe-22c55e?style=for-the-badge&logoColor=white)`
    - Project title, one-line description, "How It Works" section (3 steps), "Quick Start" installation instructions (`bun install`, add config, enable Actions), and a "Built With" section listing Bun, GitHub Actions, GitHub Pages, Polar.sh
    - Badge row at top: build status, license (MIT), version
  > Completed: README.md created with BIDME:BANNER:START/END comment block, shields.io placeholder banner linked to repo, badge row (build status, MIT license, v0.1.0), one-line description, 3-step "How It Works" (Install/Bids Come In/Get Paid), Quick Start with bun install + config + Actions, Configuration section with YAML example, Built With listing all four technologies.

- [x] Verify the full build works end-to-end:
  - Run `bun install` to ensure all dependencies resolve
  - Run `bun run scripts/demo.ts` to verify the demo script produces expected output
  - Run `bun build scripts/demo.ts --outdir=dist` to verify TypeScript compilation succeeds
  - If any step fails, fix the issue before moving on
  > Completed: All three verification steps passed. `bun install` resolved 8 installs across 9 packages (no changes needed). `bun run scripts/demo.ts` produced expected output — config loaded, $100 bid parsed, validation passed, markdown with badges generated. `bun build` bundled 6 modules into dist/demo.js (97.1 KB) in 14ms. All 80 existing tests pass (204 expect() calls across 6 test files). No fixes required.
