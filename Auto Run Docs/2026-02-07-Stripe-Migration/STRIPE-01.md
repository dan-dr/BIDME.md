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

- [ ] **Delete Polar integration** — remove `src/lib/polar-integration.ts` entirely

- [ ] **Update payment types** in `src/lib/types.ts`:
  - Add `stripe_payment_intent_id?: string` to PeriodData.payment
  - Add `stripe_customer_id?: string` to PeriodData.payment
  - Remove any Polar-specific fields

- [ ] **Update config types** in `src/lib/config.ts`:
  - Change `payment.provider` type to just `"stripe"` (remove polar options)
  - Update `DEFAULT_CONFIG.payment.provider` to `"stripe"`
  - Remove validation for old provider values
  - Update `generateToml()` comments
