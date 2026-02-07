# STRIPE-03: Init Command & Wizard Updates

## Context
The init wizard (`src/commands/init.ts`) currently offers Polar options. Remove Polar, make Stripe the only option.

## Phase 3: Wizard Updates

- [x] **Update init wizard** in `src/commands/init.ts`:
  - Remove the payment provider selection entirely (Stripe is the only option)
  - Or simplify to just show an info message: "Payment provider: Stripe"
  - Update the "Allow unlinked bidders" question text to reference "payment method" instead of "Polar account"
  - Display info message about required env var (`STRIPE_SECRET_KEY`)
  - Remove any references to "polar", "Polar", or "POLAR" throughout the file

  **Completed:** Removed Polar payment provider selection, added info messages for "Payment provider: Stripe" and "Required: STRIPE_SECRET_KEY environment variable", updated unlinked bidders question text to reference "payment method" instead of "Polar account", and hardcoded `provider: "stripe"` in return value. All 12 init tests pass.

- [x] **Update scaffold output messages** in `src/commands/init.ts`:
  - In `clack.outro()`, include Stripe setup instructions:
    ```
    Stripe setup:
      1. Create account at stripe.com
      2. Add STRIPE_SECRET_KEY to repository secrets
      3. (Optional) Set up webhook for payment confirmations
    ```

  **Completed:** Added Stripe setup instructions to `clack.outro()` message. All 12 init tests pass.

- [x] **Update init tests** in `src/commands/__tests__/init.test.ts`:
  - Remove any tests that check for Polar-specific behavior
  - Update tests to expect Stripe as the only provider

  **Completed:** Verified no Polar-specific tests existed in init.test.ts. Added explicit test "config.toml uses Stripe as the only payment provider" to document that Stripe is the only supported payment provider. All 13 init tests pass. The config.test.ts validation test for invalid providers ("polar-own") correctly remains as a negative test to ensure only "stripe" is accepted.
