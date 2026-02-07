# STRIPE-02: Bidder Registry & Payment Method Storage

## Context
The bidder registry (`src/lib/bidder-registry.ts`) tracks payment status. Needs updating for Stripe customer/payment method IDs.

## Phase 2: Registry Updates

- [x] **Update BidderRecord interface** in `src/lib/bidder-registry.ts`:
  ```typescript
  export interface BidderRecord {
    github_username: string;
    payment_linked: boolean;
    linked_at: string | null;
    warned_at: string | null;
    stripe_customer_id?: string;
    stripe_payment_method_id?: string;
  }
  ```
  Remove `payment_provider` field (Stripe is the only option now). Update `markPaymentLinked()` to accept `stripeCustomerId` and `stripePaymentMethodId` params.

  ✅ **Completed**: Updated `BidderRecord` interface with `stripe_customer_id` and `stripe_payment_method_id` fields. Removed `payment_provider` field. Updated `markPaymentLinked()` signature to accept Stripe IDs. Also updated `registerBidder()` to use new interface. Updated all test files (`bidder-registry.test.ts`, `payment-enforcement.test.ts`, `check-grace.test.ts`) to use new function signatures. All 361 tests pass.

- [x] **Add helper functions** to `src/lib/bidder-registry.ts`:
  - `getStripeCustomerId(username: string): string | null` — retrieve stored customer ID
  - `getStripePaymentMethodId(username: string): string | null` — retrieve stored payment method ID
  - `updateStripePaymentMethod(username: string, paymentMethodId: string): void` — update payment method (for when user updates card)

  ✅ **Completed**: Added three helper functions to bidder-registry.ts for Stripe ID management. `getStripeCustomerId` and `getStripePaymentMethodId` return stored IDs (null if not found), `updateStripePaymentMethod` updates the payment method for an existing bidder (throws if bidder not found). All 370 tests pass.

- [x] **Update bidder registry tests** in `src/lib/__tests__/bidder-registry.test.ts`:
  - Remove any Polar-related tests
  - Add tests for Stripe-specific fields
  - Test `getStripeCustomerId`, `getStripePaymentMethodId`, `updateStripePaymentMethod`
  - Test that `markPaymentLinked` stores Stripe IDs correctly

  ✅ **Verified Complete**: Test file already contains comprehensive Stripe-specific tests. No Polar references found. Tests include: `registerBidder` verifies `stripe_customer_id` and `stripe_payment_method_id` are undefined for new bidders, `getStripeCustomerId` (3 tests), `getStripePaymentMethodId` (3 tests), `updateStripePaymentMethod` (3 tests including error handling and field preservation), `markPaymentLinked` (2 tests verifying Stripe ID storage), and persistence tests verifying Stripe IDs are saved/loaded correctly. All 25 bidder-registry tests pass.
