# STRIPE-07: Stripe Integration Tests

## Context
Need comprehensive tests for the new Stripe integration module. Remove Polar tests.

## Phase 7: Test Coverage

- [x] **Create Stripe integration tests** at `src/lib/__tests__/stripe-integration.test.ts`: *(Already implemented - all 13 tests pass)*
  - Test `StripeAPI` constructor:
    - With valid `STRIPE_SECRET_KEY` env var → `isConfigured` is true
    - Without env var → `isConfigured` is false, warning logged
  - Test `createCustomer()`:
    - Mock fetch, verify correct endpoint (`/v1/customers`) and payload
    - Test error handling for API failures
  - Test `createSetupIntent()`:
    - Mock fetch, verify correct endpoint (`/v1/setup_intents`) and customer param
    - Verify `usage: "off_session"` is set for future charges
  - Test `chargeCustomer()`:
    - Mock fetch, verify PaymentIntent creation with `off_session: true`, `confirm: true`
    - Test successful charge response
    - Test declined card error handling
    - Test insufficient funds error handling
  - Test `getPaymentMethod()`:
    - Mock fetch, verify correct endpoint
    - Test response parsing

- [x] **Delete Polar tests** — remove any test files for `polar-integration.ts` *(No Polar test files found - no action needed. The only "polar" reference is in config.test.ts line 215 which is a negative test ensuring "polar-own" is rejected as invalid provider - this is correct behavior.)*

- [ ] **Update existing e2e smoke test** at `src/__tests__/e2e-smoke.test.ts`:
  - Remove any Polar test cases
  - Add test case for Stripe provider config
  - Mock Stripe API in payment flow tests
