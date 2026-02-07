# STRIPE-01: Core Types & Stripe Integration Module

## Context
Replace Polar.sh with Stripe for payment processing. Stripe provides the required functionality:
1. **SetupIntent** — verify/save payment method without charging
2. **PaymentIntent with off_session** — charge dynamic amounts later

## Phase 1: Core Infrastructure

- [x] **Create Stripe integration module** (`src/lib/stripe-integration.ts`). Include:
  - `StripeConfig` interface with `secretKey`, `publishableKey`, `webhookSecret`
  - `StripeAPI` class with `isConfigured` getter, constructor that reads `STRIPE_SECRET_KEY` env var
  - `createSetupIntent(customerId: string)` — returns SetupIntent for saving payment method
  - `createCustomer(email: string, metadata: { github_username: string })` — create Stripe customer
  - `chargeCustomer(customerId: string, paymentMethodId: string, amount: number, metadata: Record<string, string>)` — create PaymentIntent with `off_session: true`
  - `getPaymentMethod(paymentMethodId: string)` — retrieve saved payment method details
  - Error classes: `StripeAPIError`, `StripePaymentError`
  - Use native `fetch` for API calls, base URL `https://api.stripe.com/v1`
  - All amounts in cents (Stripe standard)

  ✅ **Completed 2026-02-07**: Created `src/lib/stripe-integration.ts` with full test coverage (13 tests in `src/lib/__tests__/stripe-integration.test.ts`). Implements all specified interfaces (`StripeConfig`, `StripeSetupIntent`, `StripeCustomer`, `StripePaymentIntent`, `StripePaymentMethod`), `StripeAPI` class with all required methods, and error classes (`StripeAPIError`, `StripePaymentError`). Uses native fetch with form-urlencoded encoding per Stripe API requirements.

- [x] **Delete Polar integration** — remove `src/lib/polar-integration.ts` entirely

  ✅ **Completed 2026-02-07**: Deleted `src/lib/polar-integration.ts`. Updated `src/commands/close-bidding.ts` to stub out the payment processing function (now returns null with a TODO note for STRIPE-07). Build and all 361 tests pass.

- [x] **Update payment types** in `src/lib/types.ts`:
  - Add `stripe_payment_intent_id?: string` to PeriodData.payment
  - Add `stripe_customer_id?: string` to PeriodData.payment
  - Remove any Polar-specific fields

  ✅ **Completed 2026-02-07**: Updated `PeriodData.payment` in `src/lib/types.ts` to replace Polar-specific fields (`checkout_url`, `product_id`, `checkout_id`) with Stripe fields (`stripe_customer_id`, `stripe_payment_intent_id`). Changed `payment_status` enum from `"pending" | "paid" | "expired"` to `"pending" | "paid" | "failed"`. Updated `src/commands/close-bidding.ts` to remove `checkout_url` reference (now passes `undefined` to `generateWinnerAnnouncement`). All 361 tests pass.

- [x] **Update config types** in `src/lib/config.ts`:
  - Change `payment.provider` type to just `"stripe"` (remove polar options)
  - Update `DEFAULT_CONFIG.payment.provider` to `"stripe"`
  - Remove validation for old provider values
  - Update `generateToml()` comments

  ✅ **Completed 2026-02-07**: Updated `BidMeConfig.payment.provider` type from `"polar-own" | "bidme-managed"` to `"stripe"`. Changed `DEFAULT_CONFIG.payment.provider` to `"stripe"`. Updated `validateConfig` to accept only `"stripe"` as valid provider. Updated `generateToml()` payment section comment to `"# Payment configuration (Stripe)"`. Updated 6 test files to expect `"stripe"` instead of polar values. All 361 tests pass.
