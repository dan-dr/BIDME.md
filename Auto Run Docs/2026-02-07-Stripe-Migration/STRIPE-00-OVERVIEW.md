# Stripe Migration Overview

## Summary
Replace Polar.sh with Stripe for BidMe payment processing. Stripe provides:
1. **SetupIntent** — verify/save payment method without charging
2. **PaymentIntent with off_session** — charge dynamic bid amounts later

This is critical for the bidding auction model where payment amount isn't known until bidding closes.

## Why Stripe?
- Polar.sh doesn't support saving payment methods via API (only through checkout)
- Polar.sh doesn't support charging arbitrary amounts off-session without subscription context
- Stripe's SetupIntent + PaymentIntent model is designed exactly for this use case

## Breaking Change
**v0.3.0 removes Polar.sh support entirely.** Users must migrate to Stripe.

## Phase Documents

| Phase | File | Description |
|-------|------|-------------|
| 1 | STRIPE-01.md | Core types, Stripe module, delete Polar |
| 2 | STRIPE-02.md | Bidder registry & payment method storage |
| 3 | STRIPE-03.md | Init command & wizard updates |
| 4 | STRIPE-04.md | Close bidding command — Stripe charging |
| 5 | STRIPE-05.md | Process bid — payment verification flow |
| 6 | STRIPE-06.md | Workflow templates & environment variables |
| 7 | STRIPE-07.md | Stripe integration tests |
| 8 | STRIPE-08.md | Package updates & final cleanup |

## Files Changed

### New Files
- `src/lib/stripe-integration.ts` — Stripe API client
- `src/lib/__tests__/stripe-integration.test.ts` — Tests

### Deleted Files
- `src/lib/polar-integration.ts` — Removed

### Modified Files
- `src/lib/types.ts` — Add Stripe payment fields, remove Polar fields
- `src/lib/config.ts` — Stripe-only provider
- `src/lib/bidder-registry.ts` — Add Stripe customer/PM IDs, remove Polar
- `src/commands/init.ts` — Stripe-only wizard
- `src/commands/close-bidding.ts` — Stripe charging logic
- `src/commands/process-bid.ts` — Update payment links
- `src/lib/issue-template.ts` — Remove Polar references
- `templates/workflows/*.yml` — Stripe env vars only
- `.github/workflows/*.yml` — Stripe env vars only
- `README.md` — Stripe documentation only
- `package.json` — Version bump to 0.3.0

## Environment Variables

| Variable | Required |
|----------|----------|
| `STRIPE_SECRET_KEY` | Yes |

## Execution Order

Run phases 1-8 sequentially. Each phase builds on the previous.
