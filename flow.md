# BIDME V1 Flow

```mermaid
flowchart TD
  A[Scheduler opens bidding issue] --> B[Advertiser comments with bid YAML + banner image]
  B --> C[process-bid workflow]
  C --> D{Valid bid + passes house rules?}
  D -- no --> E[Edit comment: strikethrough + reject reason]
  D -- yes --> F{Stripe payment method linked?}
  F -- yes --> G[Record bid active]
  G --> H[Edit comment: accepted + rank]
  F -- no --> I[Create Stripe Checkout session]
  I --> J[Record bid unlinked_pending]
  J --> K[Edit comment: payment required + Stripe link]
  H --> L[Update issue leaderboard]
  K --> L

  M[Bidder completes Stripe-hosted card setup] --> N[Stripe saves payment method]

  O[Scheduled check-grace every 15m] --> P[For each unlinked_pending bid: poll Stripe]
  P --> Q{Payment method found?}
  Q -- yes --> R[Activate bid + edit comment: accepted]
  Q -- no --> S{Grace window elapsed?}
  S -- yes --> T[Expire bid + edit comment: expired]
  S -- no --> U[Leave pending]
  R --> V[Update issue leaderboard]
  T --> V

  W[Scheduled close] --> X[Select highest active bid]
  X --> Y[Charge saved Stripe payment method]
  Y --> Z[Download winning banner + update README banner block]
  Z --> AB[Commit banner, README, archive to a branch and open a PR]
  AB --> AA[Comment winner + PR link on the issue]
  AA --> AC[Close + unpin issue, clear period variable]

  AC[Scheduled analytics] --> AD[Fetch GitHub traffic/referrers + clicks]
  AD --> AE[Persist analytics snapshots + refresh dashboard]
```

There is no owner approval step. A bid is valid the moment Stripe is linked, and
the highest active bid at close wins. The owner's only gate is
`content_guidelines.prohibited` (house rules, e.g. "crypto"); anything else is
handled by the owner deleting a comment manually.

On close, BIDME does **not** push to `main` directly. It downloads the winning
banner into the repo, updates the README to reference it (with a link below the
banner back to the winning bid comment), archives the period, and opens a PR.
Merging the PR publishes the banner.
