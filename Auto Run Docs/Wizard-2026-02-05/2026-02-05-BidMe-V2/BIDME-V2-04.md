# Phase 04: Payment Enforcement & Bidder Verification

This phase implements the payment-before-bidding enforcement system. Bidders must have a linked payment method before their bid is accepted (configurable). The system handles unlinked bidders with configurable responses: strikethrough their bid, reply with a warning, and give them a grace period to link payment. It also lays groundwork for the two-mode payment system (bring-your-own Polar vs BidMe managed).

## Tasks

- [x] Create the bidder verification system:
  - `src/lib/bidder-registry.ts`:
    - Manages a registry of known bidders and their payment status, stored in `.bidme/data/bidders.json`
    - Interface `BidderRecord`: `{ github_username, payment_linked: boolean, payment_provider: string | null, linked_at: string | null, warned_at: string | null }`
    - `getBidder(username: string): BidderRecord | null`
    - `registerBidder(username: string): BidderRecord` — creates entry with `payment_linked: false`
    - `markPaymentLinked(username: string, provider: string): void`
    - `isPaymentLinked(username: string): boolean`
    - `getGraceDeadline(username: string, graceHours: number): Date | null` — returns deadline based on `warned_at + graceHours`
    - `saveBidders()` / `loadBidders()` — persist to `.bidme/data/bidders.json`
  - Initialize empty `bidders.json` during `bidme init` scaffolding (update `src/lib/scaffold.ts`)

- [x] Integrate payment verification into the bid processor:
  - Update `src/commands/process-bid.ts`:
    - After parsing and validating bid format, check bidder's payment status via `bidder-registry.ts`
    - **If `config.enforcement.require_payment_before_bid` is true AND bidder is not linked:**
      - If `config.enforcement.strikethrough_unlinked` is true: edit the original comment to wrap bid content in `~~strikethrough~~`
      - Post a reply comment: "⚠️ @{bidder} — your bid has been paused. Please [link your payment method]({payment_link}) within {grace_hours} hours to activate your bid. Bids without linked payment will be removed."
      - Set bid status to `"unlinked_pending"` (new status)
      - Record `warned_at` in bidder registry
    - **If `config.payment.allow_unlinked_bids` is true (lenient mode):**
      - Accept the bid normally but add a warning in the confirmation: "Note: You haven't linked a payment method yet. Link one at {payment_link} to avoid delays if you win."
      - Set bid status to `"pending"` as normal
    - **If bidder IS linked:** proceed with normal bid acceptance flow
    - The `{payment_link}` URL should be configurable in config or default to a BidMe-provided URL pattern

- [ ] Create a grace period checker command:
  - `src/commands/check-grace.ts`:
    - Scans all bids with `"unlinked_pending"` status in current period
    - For each, checks if the bidder has since linked payment (re-check registry)
    - If linked: update bid status to `"pending"` (or `"approved"` if auto-approve mode), un-strikethrough the comment, post "Payment linked! Your bid is now active."
    - If grace period expired and still unlinked: set bid status to `"expired"`, post "Your bid has been removed — grace period expired without payment linked."
    - Register as CLI command: `bidme check-grace` in `src/cli.ts`
  - This command will be called by a scheduled GitHub Action (created in Phase 05)

- [ ] Create the Polar.sh integration for two-mode payment:
  - Update `src/lib/polar-integration.ts`:
    - **Mode 1 — "polar-own"**: Repo owner's own Polar.sh account. Checkout sessions created under their token (existing behavior). Token from `POLAR_ACCESS_TOKEN` secret.
    - **Mode 2 — "bidme-managed"**: BidMe's Polar.sh account (future Stripe Connect). For now, implement as a stub that:
      - Logs "BidMe managed payments coming soon — using direct Polar for now"
      - Falls back to Mode 1 behavior
      - Adds a `bidme_fee_percent` field to config (default 10) for future use
    - `createPaymentLink(bid, config): string` — returns a checkout URL that the bidder can use to pay
    - Keep existing `createProduct()` and `createCheckoutSession()` methods
    - Document in code comments that Mode 2 will require Stripe Connect (Polar AUP prohibits marketplace use)

- [ ] Write tests for the payment enforcement system:
  - `src/lib/__tests__/bidder-registry.test.ts`:
    - Test registering new bidder, checking unlinked status
    - Test marking payment as linked
    - Test grace period calculation
    - Test persistence to/from JSON file
  - `src/commands/__tests__/payment-enforcement.test.ts`:
    - Test strict mode: unlinked bidder gets strikethrough + warning
    - Test lenient mode: unlinked bidder gets warning but bid proceeds
    - Test linked bidder: bid proceeds normally
    - Test grace period expiry removes bid
    - Test grace period completion restores bid
  - Use mocked GitHub API

- [ ] Run payment tests and fix any failures until all pass.
