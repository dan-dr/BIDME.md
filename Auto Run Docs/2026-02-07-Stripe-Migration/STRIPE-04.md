# STRIPE-04: Close Bidding Command — Stripe Charging

## Context
`src/commands/close-bidding.ts` currently uses `PolarAPI` to process payments. Replace with Stripe.

## Phase 4: Close Bidding Updates

- [x] **Replace Polar with Stripe in close-bidding.ts**: ✅ Completed
  - Removed TODO comment for Polar/STRIPE-07
  - Imported `StripeAPI`, `StripePaymentError` from `../lib/stripe-integration.ts`
  - Imported `loadBidders`, `getStripeCustomerId`, `getStripePaymentMethodId` from `../lib/bidder-registry.ts`
  - Reimplemented `processPayment()` function to:
    - Get winner's `stripe_customer_id` and `stripe_payment_method_id` from bidder registry
    - Call `stripeApi.chargeCustomer()` with winning bid amount (converted to cents)
    - Return payment data with `stripe_payment_intent_id` on success
    - Handle `StripePaymentError` gracefully — logs error but doesn't block period close
    - Returns `pending` status when no payment method on file
  - Removed all Polar-related code paths
  - Updated console logging for Stripe

- [x] **Update winner announcement** in `close-bidding.ts`: ✅ Completed
  - Added `stripePaymentSuccess` variable to track payment outcome
  - Updated `generateWinnerAnnouncement` call to pass payment status message
  - If Stripe charge succeeded: "✅ Payment processed successfully"
  - If Stripe payment failed/pending: "⏳ Payment pending — winner will be contacted"
  - Modified `generateWinnerAnnouncement` in `issue-template.ts` to accept `paymentStatus` instead of `checkoutUrl`

- [x] **Update close-bidding tests** in `src/commands/__tests__/bidding.test.ts`: ✅ Completed
  - Changed `POLAR_API_KEY` references to `STRIPE_SECRET_KEY`
  - Added `mockFetchForStripe()` function that mocks both GitHub and Stripe API calls
  - Added new test suite "close-bidding: Stripe payment processing" with 4 tests:
    - `charges winner via Stripe when payment method is on file` - verifies successful charge flow
    - `handles Stripe payment failure gracefully` - tests card decline scenario
    - `marks payment as pending when no payment method on file` - tests missing payment method
    - `skips payment when Stripe is not configured` - tests graceful degradation
  - All 40 tests pass
