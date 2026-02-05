---
type: analysis
title: README Documentation Gaps - Loop 00001
created: 2026-02-05
tags:
  - readme-accuracy
  - documentation-gaps
related:
  - "[[LOOP_00001_FEATURE_INVENTORY]]"
  - "[[2_FIND_GAPS]]"
---

# Documentation Gaps - Loop 00001

## Summary
- **Total Gaps Found:** 12
- **MISSING (undocumented features):** 8
- **STALE (removed features still documented):** 1
- **INACCURATE (wrong descriptions):** 2
- **INCOMPLETE (needs more detail):** 1

---

## Gap List

### GAP-001: `--defaults` flag on `bidme init`
- **Type:** MISSING
- **Feature:** `--defaults` flag skips interactive prompts and uses all default values
- **Code Location:** `src/cli.ts:27-28`
- **README Location:** Not mentioned
- **Description:**
  `bidme init --defaults` allows users to skip the interactive wizard and scaffold with all default config values. Not documented anywhere in the README.
- **Evidence:**
  - Code: `.option("--defaults", "Skip interactive prompts and use all defaults", false)`
  - README: Not mentioned
- **User Impact:** Power users and CI pipelines need non-interactive init; without this flag documented, they may not know it exists.

### GAP-002: `--target <path>` flag on all commands
- **Type:** MISSING
- **Feature:** `--target <path>` option available on every command to specify a different project directory
- **Code Location:** `src/cli.ts` (every command definition)
- **README Location:** Not mentioned
- **Description:**
  Every CLI command accepts `--target <path>` to operate on a different directory than cwd. This is useful for monorepos or CI environments.
- **Evidence:**
  - Code: `.option("--target <path>", "Target directory ...", process.cwd())` on all commands
  - README: Not mentioned
- **User Impact:** Users working in monorepos or running BidMe from CI don't know they can point to a specific project directory.

### GAP-003: `--version` / `-v` flag
- **Type:** MISSING
- **Feature:** Version display flag
- **Code Location:** `src/cli.ts:21`
- **README Location:** Not mentioned
- **Description:**
  `bidme --version` or `bidme -v` prints the current version. Standard CLI flag but not listed in the Commands table.
- **Evidence:**
  - Code: `.version(getVersion(), "-v, --version", "Print the current version")`
  - README: Not mentioned in Commands table
- **User Impact:** Minor — users expect `--version` but can't confirm without trying. Low priority.

### GAP-004: `[enforcement]` config section
- **Type:** MISSING
- **Feature:** Enforcement configuration with `require_payment_before_bid` and `strikethrough_unlinked`
- **Code Location:** `src/lib/config.ts:28-31`
- **README Location:** Not mentioned in Configuration section
- **Description:**
  The `[enforcement]` TOML section controls whether payment must be linked before bidding and whether unlinked bids are struck through. Defaults: `require_payment_before_bid = true`, `strikethrough_unlinked = true`.
- **Evidence:**
  - Code: Full interface and defaults in `config.ts:28-31, 66-69`
  - README: Configuration example only shows `[bidding]`, `[banner]`, `[approval]`, `[payment]`, `[content_guidelines]`
- **User Impact:** Repo owners don't know they can relax payment enforcement or change how unlinked bids display.

### GAP-005: `[tracking]` config section
- **Type:** MISSING
- **Feature:** UTM tracking configuration with `append_utm` and `utm_params`
- **Code Location:** `src/lib/config.ts:32-35`
- **README Location:** Not mentioned in Configuration section
- **Description:**
  The `[tracking]` TOML section enables UTM parameter appending on bid destination URLs. Defaults: `append_utm = true`, `utm_params = "source=bidme&repo={owner}/{repo}"`.
- **Evidence:**
  - Code: Full interface and defaults in `config.ts:32-35, 70-73`
  - README: Not mentioned
- **User Impact:** Repo owners don't know bid links include UTM tracking by default or that they can customize/disable it.

### GAP-006: `approval.mode = "auto"` option
- **Type:** MISSING
- **Feature:** Auto-approval mode that skips emoji approval
- **Code Location:** `src/lib/config.ts:18`
- **README Location:** Configuration section shows only `mode = "emoji"`
- **Description:**
  The approval mode supports both `"emoji"` and `"auto"`. Auto mode auto-accepts all valid bids without requiring owner interaction. README only documents `"emoji"`.
- **Evidence:**
  - Code: `mode: "auto" | "emoji"` type, validated in `config.ts:149`
  - README: `mode = "emoji"  # Approve winning bid with a reaction`
- **User Impact:** Users wanting hands-off operation don't know auto-approval exists.

### GAP-007: Additional `[payment]` config options
- **Type:** MISSING
- **Feature:** `allow_unlinked_bids`, `unlinked_grace_hours`, and `payment_link` options
- **Code Location:** `src/lib/config.ts:23-26`
- **README Location:** Payment section only shows `provider` and `bidme_fee_percent`
- **Description:**
  Three payment config options are undocumented: `allow_unlinked_bids` (default: false), `unlinked_grace_hours` (default: 24), and `payment_link` (default: "https://bidme.dev/link-payment").
- **Evidence:**
  - Code: Full payment interface in `config.ts:22-27` with defaults at lines 60-65
  - README: `[payment]` section only shows `provider = "polar-own"` and `bidme_fee_percent = 10`
- **User Impact:** Users don't know they can allow bids from users without linked payment accounts or configure the grace period.

### GAP-008: Click tracking via `redirect.html`
- **Type:** MISSING
- **Feature:** GitHub Pages redirect page for tracking banner clicks
- **Code Location:** `templates/redirect.html`
- **README Location:** Not mentioned
- **Description:**
  BidMe ships a redirect HTML template that enables click tracking on banner links via a GitHub Pages intermediary page. This feature is not mentioned anywhere in the README.
- **Evidence:**
  - Code: `templates/redirect.html` exists in the template directory
  - README: Not mentioned
- **User Impact:** Users don't know banner click tracking is available or how to enable it.

### GAP-009: Bid YAML `alt_text` field (stale)
- **Type:** STALE
- **Feature:** `alt_text` field in bid YAML format
- **Code Location:** `src/lib/validation.ts:20-44`
- **README Location:** "For Advertisers" section, lines 86, 96
- **Description:**
  The README documents `alt_text` as a required bid field, but the code's `parseBidComment()` function does not parse or use `alt_text`. The `ParsedBid` interface only has `amount`, `banner_url`, `destination_url`, and `contact`.
- **Evidence:**
  - Code: `ParsedBid` interface has 4 fields, no `alt_text`; parser extracts only those 4
  - README: Lists `alt_text` as required with description "Accessible description of your banner"
- **User Impact:** Advertisers include an `alt_text` field that is silently ignored. Misleading documentation.

### GAP-010: Bid YAML `url` vs `destination_url` field name
- **Type:** INACCURATE
- **Feature:** Destination URL field name in bid YAML
- **Code Location:** `src/lib/validation.ts:36`
- **README Location:** "For Advertisers" section, lines 84, 94
- **Description:**
  The README documents the field as `url` but the code parser extracts `destination_url`. Bids using `url` (as documented) will fail validation because the parser won't find a `destination_url` value.
- **Evidence:**
  - Code: `const destination_url = fields["destination_url"] ?? ""`
  - README: `url: "https://yourcompany.com"` and table says `url | Yes | Click-through destination URL`
- **User Impact:** **Critical** — Advertisers following README instructions will have their bids rejected. The field name mismatch causes silent parsing failure.

### GAP-011: Contact field accepts GitHub usernames
- **Type:** INACCURATE
- **Feature:** Contact field validation accepts `@username` format
- **Code Location:** `src/lib/validation.ts:96-104`
- **README Location:** "For Advertisers" section, line 97
- **Description:**
  The README describes the contact field as "Email for bid communications" but the code also accepts GitHub usernames in `@user` format.
- **Evidence:**
  - Code: `const githubUserRegex = /^@[\w-]+$/;` — accepts either email or @username
  - README: `contact | Yes | Email for bid communications`
- **User Impact:** Advertisers who prefer to use their GitHub handle don't know it's a valid option.

### GAP-012: `bidme_fee_percent` is configurable
- **Type:** INCOMPLETE
- **Feature:** Fee percentage is a configurable option, not a fixed value
- **Code Location:** `src/lib/config.ts:27, 65`
- **README Location:** Configuration section, line 47
- **Description:**
  The README shows `bidme_fee_percent = 10` in the config example, which implies it's configurable. However, the Payment Setup section doesn't mention this is adjustable or explain what range is valid (0-100).
- **Evidence:**
  - Code: Validated as `number between 0 and 100` in `config.ts:173-180`
  - README: Shows the value but doesn't explain it's adjustable or its valid range
- **User Impact:** Minor — users may not realize they can change the fee or what valid values are.

---

## Gaps by Type

### MISSING Features
| Gap ID | Feature | Code Location | User Impact |
|--------|---------|---------------|-------------|
| GAP-001 | `--defaults` flag | `src/cli.ts:27-28` | CI/power users can't discover non-interactive init |
| GAP-002 | `--target <path>` flag | `src/cli.ts` (all commands) | Monorepo/CI users can't discover directory targeting |
| GAP-003 | `--version` / `-v` | `src/cli.ts:21` | Minor — standard flag undocumented |
| GAP-004 | `[enforcement]` config | `src/lib/config.ts:28-31` | Users can't discover payment enforcement controls |
| GAP-005 | `[tracking]` config | `src/lib/config.ts:32-35` | Users don't know UTM tracking exists or is on by default |
| GAP-006 | `approval.mode = "auto"` | `src/lib/config.ts:18` | Users wanting hands-off operation miss auto mode |
| GAP-007 | Payment config options | `src/lib/config.ts:23-26` | Users can't configure unlinked bid behavior |
| GAP-008 | Click tracking redirect | `templates/redirect.html` | Users miss click tracking feature entirely |

### STALE Documentation
| Gap ID | Feature | README Section | What Changed |
|--------|---------|----------------|--------------|
| GAP-009 | `alt_text` bid field | For Advertisers (line 86, 96) | Code does not parse or validate `alt_text`; field is ignored |

### INACCURATE Documentation
| Gap ID | Feature | What's Wrong | Correct Behavior |
|--------|---------|--------------|------------------|
| GAP-010 | Bid `url` field name | README says `url` | Code expects `destination_url` |
| GAP-011 | Contact field format | README says "Email" only | Code accepts email OR `@username` |

### INCOMPLETE Documentation
| Gap ID | Feature | What's Missing |
|--------|---------|----------------|
| GAP-012 | `bidme_fee_percent` | Missing explanation that it's adjustable and valid range (0-100) |

---

## Priority Indicators

### High Priority Gaps
Features that directly cause user errors or bid failures:
1. GAP-010: Bid `url` vs `destination_url` — **Bids will silently fail** if advertisers follow README
2. GAP-009: `alt_text` stale field — Misleads advertisers into providing unused data
3. GAP-004: `[enforcement]` config — Controls critical payment enforcement behavior

### Medium Priority Gaps
Features that regular users would use:
1. GAP-006: `approval.mode = "auto"` — Useful for high-volume repos wanting automated flow
2. GAP-007: Payment config options — Important for repos wanting to allow unlinked bids
3. GAP-005: `[tracking]` config — Users should know UTM tracking is on by default
4. GAP-001: `--defaults` flag — Essential for CI/automation use cases
5. GAP-011: Contact accepts @username — Useful for GitHub-native workflows

### Low Priority Gaps
Advanced features or edge cases:
1. GAP-002: `--target <path>` — Niche for monorepo setups
2. GAP-003: `--version` flag — Standard CLI convention, easily discovered
3. GAP-008: Click tracking redirect — Advanced analytics feature
4. GAP-012: Fee percent range — Config example already implies adjustability
