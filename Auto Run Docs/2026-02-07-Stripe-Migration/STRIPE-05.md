# STRIPE-05: Process Bid — Payment Verification Flow

## Context
`src/commands/process-bid.ts` checks if bidder has linked payment. Update all references for Stripe.

## Phase 5: Bid Processing Updates

- [x] **Update process-bid.ts** payment link flow:
  - Change `paymentLink` variable to point to Stripe payment setup page: `https://bidme.dev/link-stripe?user={github_username}`
  - Update warning message text: "Please link your payment method" (already generic, verify no Polar references)
  - The `isPaymentLinked()` check already works — it reads `payment_linked` from registry
  - Search for and remove any "polar", "Polar", or "POLAR" references in the file

  **Completed:** Updated `paymentLink` default URL in `process-bid.ts:154` to `https://bidme.dev/link-stripe?user=${encodeURIComponent(bidder)}`. Confirmed no Polar references exist in the file. Warning messages at lines 171-173 and 204-205 are already generic ("payment method").

- [x] **Update payment warning messages** in `process-bid.ts`:
  - Line ~171: Ensure URL points to Stripe setup page
  - Line ~205: Ensure paymentWarning text is Stripe-appropriate
  - Verify no Polar-specific terminology remains

  **Verified:** Line 171-173 uses `paymentLink` variable which defaults to Stripe URL at line 154. Line 205 `paymentWarning` uses generic "payment method" language. Grep search confirmed no Polar references exist in the file.

- [x] **Update issue-template.ts**:
  - Check `src/lib/issue-template.ts` for any Polar references
  - Remove or update any Polar-specific language
  - Ensure payment messaging is generic ("payment method" not "Polar account")

  **Verified:** Reviewed `src/lib/issue-template.ts` (212 lines). Grep search confirmed no Polar references exist in the file. All payment messaging uses generic language. The file contains bidding templates with "💳 Payment" section headers but no provider-specific terminology. Note: `src/lib/__tests__/config.test.ts:215` contains `polar-own` as a test case, but this is intentional - it validates that the config rejects non-Stripe providers, confirming the Stripe-only migration is working correctly.
