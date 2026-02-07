/**
 * Represents a single bid submitted by a user for a banner advertising slot.
 *
 * Tracks the full lifecycle of a bid from submission through approval or rejection.
 * Each bid is tied to a GitHub issue comment and belongs to a {@link PeriodData} bidding period.
 *
 * @property bidder - GitHub username of the person who placed the bid.
 * @property amount - Bid amount in USD.
 * @property banner_url - URL of the banner image to display in the README.
 * @property destination_url - Click-through URL when the banner is clicked.
 * @property contact - Contact information provided by the bidder (e.g. email).
 * @property status - Current lifecycle state of the bid:
 *   - `"pending"` — Awaiting repo owner approval.
 *   - `"approved"` — Accepted by the repo owner.
 *   - `"rejected"` — Declined by the repo owner.
 *   - `"unlinked_pending"` — Bidder has not linked a payment method; subject to grace period.
 *   - `"expired"` — Grace period elapsed without payment linkage.
 * @property comment_id - GitHub issue comment ID where the bid was submitted.
 * @property timestamp - ISO 8601 timestamp of when the bid was recorded.
 *
 * @example
 * ```ts
 * const bid: BidRecord = {
 *   bidder: "octocat",
 *   amount: 50,
 *   banner_url: "https://example.com/banner.png",
 *   destination_url: "https://example.com",
 *   contact: "octocat@github.com",
 *   status: "pending",
 *   comment_id: 12345,
 *   timestamp: "2026-02-05T12:00:00Z",
 * };
 * ```
 */
export interface BidRecord {
  bidder: string;
  amount: number;
  banner_url: string;
  destination_url: string;
  contact: string;
  status: "pending" | "approved" | "rejected" | "unlinked_pending" | "expired";
  comment_id: number;
  timestamp: string;
}

export interface PeriodData {
  period_id: string;
  status: "open" | "closed";
  start_date: string;
  end_date: string;
  issue_number: number;
  issue_url: string;
  bids: BidRecord[];
  created_at: string;
  issue_node_id?: string;
  payment?: {
    payment_status: "pending" | "paid" | "failed";
    stripe_customer_id?: string;
    stripe_payment_intent_id?: string;
  };
}
