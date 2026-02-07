# STRIPE-06: Workflow Templates & Environment Variables

## Context
GitHub Actions workflows need to use `STRIPE_SECRET_KEY`. Remove all `POLAR_ACCESS_TOKEN` references.

## Phase 6: Workflow Updates

- [x] **Update workflow templates** in `templates/workflows/`:
  - `bidme-close-bidding.yml`: Replace `POLAR_ACCESS_TOKEN` with `STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}`
  - `bidme-process-bid.yml`: Replace `POLAR_ACCESS_TOKEN` with `STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}`
  - Remove any Polar-related comments or env vars
  - ✅ Completed: Both workflow templates updated to use `STRIPE_SECRET_KEY` env var. No other Polar references found in any workflow templates.

- [x] **Update existing workflows** in `.github/workflows/` (the ones in the bidme repo itself for testing):
  - `bidme-close-bidding.yml`: Replace Polar with Stripe env var
  - `bidme-process-bid.yml`: Replace Polar with Stripe env var
  - Remove any other Polar references in workflow files
  - ✅ Completed: Updated `bidme-close-bidding.yml`, `bidme-process-bid.yml`, and `close-bidding.yml` to use `STRIPE_SECRET_KEY` instead of `POLAR_ACCESS_TOKEN`. Verified no remaining Polar references in any workflow files.

- [x] **Update README.md** documentation:
  - Remove all Polar documentation
  - Document Stripe as the payment provider
  - Add "Environment Variables" section:
    - `STRIPE_SECRET_KEY` — required, your Stripe secret key
  - Update any setup instructions that mention Polar
  - ✅ Completed: Updated README.md to replace all Polar references with Stripe. Changed "How It Works" section (line 22), config example `provider` value (line 46), and rewrote "Payment Setup" section with Stripe instructions. Added new "Environment Variables" section documenting `STRIPE_SECRET_KEY`.
