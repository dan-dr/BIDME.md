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
 * @property tagline - Short sponsor tagline shown in the bidding table.
 * @property contact - Optional contact information provided by the bidder.
 * @property status - Current lifecycle state of the bid:
 *   - `"active"` — Valid bid with a linked Stripe payment method; competes for the slot.
 *   - `"unlinked_pending"` — Valid bid awaiting a linked Stripe payment method.
 *   - `"rejected"` — Failed validation or content rules.
 *   - `"expired"` — Grace window elapsed without a linked payment method.
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
 *   tagline: "Build faster",
 *   status: "active",
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
  tagline?: string;
  contact?: string;
  status: "active" | "unlinked_pending" | "rejected" | "expired";
  comment_id: number;
  timestamp: string;
}

export interface AnalyticsDailyView {
  date: string;
  count: number;
  uniques: number;
}

export interface AnalyticsClick {
  banner_id: string;
  timestamp: string;
  referrer?: string;
}

export interface PeriodAnalytics {
  period_id: string;
  views: number;
  clicks: number;
  ctr: number;
  start_date: string;
  end_date: string;
}

export interface LegacyAnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  dailyViews: AnalyticsDailyView[];
  clicks: AnalyticsClick[];
  countries: Record<string, number>;
  periods: PeriodAnalytics[];
  lastUpdated: string;
}

export interface PeriodData {
  period_id: string;
  status: "open" | "closed";
  start_date: string;
  end_date: string;
  issue_number: number;
  issue_url?: string;
  bids: BidRecord[];
  created_at?: string;
  issue_node_id?: string;
  payment?: {
    payment_status: "pending" | "paid" | "failed";
    stripe_customer_id?: string;
    stripe_payment_intent_id?: string;
  };
}
