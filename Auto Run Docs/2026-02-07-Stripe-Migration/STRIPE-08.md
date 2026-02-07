# STRIPE-08: Package Updates & Cleanup

## Context
Final cleanup: update package.json, remove all Polar code, update version.

## Phase 8: Finalization

- [x] **Update package.json**:
  - Bump version to `0.3.0` (minor version for breaking change)
  - Add `stripe` to keywords array
  - Remove `polar` from keywords if present
  - No new dependencies needed (using native fetch)
  - ✅ Done: Bumped version 0.2.0 → 0.3.0, added keywords array with "stripe" and related terms

- [x] **Final Polar cleanup** — search entire codebase for remaining Polar references:
  - Run `grep -ri "polar" src/` and remove any remaining references
  - Check all imports for polar-integration
  - Verify `src/lib/polar-integration.ts` is deleted (should be done in STRIPE-01)
  - ✅ Done: Verified `polar-integration.ts` is deleted. Remaining "polar" references in src/ are legitimate test assertions that verify Polar is NOT supported (e2e-smoke.test.ts tests Stripe is provider, config.test.ts tests "polar-own" is rejected). No actual Polar code/imports exist.

- [x] **Run full test suite and fix any failures**:
  - Run `bun test` and ensure all tests pass
  - Run `bun run typecheck` and fix any type errors
  - Run `bun run build` and verify CLI builds correctly
  - ✅ Done: Fixed 1 test failure (updated `generateWinnerAnnouncement` test to use new paymentStatus parameter instead of checkout URL). Fixed 6 TypeScript errors in stripe-integration.test.ts (mock functions needed `as unknown as typeof fetch` cast for Bun's stricter type checking). All 377 tests pass, typecheck clean, build successful.

- [ ] **Update .bidme/config.toml** in the bidme repo itself:
  - Change `provider = "polar-own"` to `provider = "stripe"`
  - This is for testing the migration on the repo itself

## Breaking Change Notes

This is a breaking change for v0.3.0:
- Polar.sh is no longer supported
- Users must migrate to Stripe
- Add `STRIPE_SECRET_KEY` to GitHub repository secrets
- Bidders will need to re-link payment methods via Stripe
